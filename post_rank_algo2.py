from pyspark.sql import SparkSession
from graphframes import *
from pyspark.sql.functions import col, lit, sum as _sum, count, when
from pyspark.sql import functions as F
from pyspark.sql.functions import current_timestamp


import os



def main():

    mysql_jar_path = "mysql-connector-j-8.4.0.jar"
    os.environ["PYSPARK_SUBMIT_ARGS"] = f"--jars {mysql_jar_path} pyspark-shell"

    properties = {
        "user": "admin",
        "password": "rds-password",
        "driver": "com.mysql.jdbc.Driver"
    }

    spark = SparkSession.builder \
        .appName("Post Ranking") \
        .master('locals') \
        .config('spark.jars.packages', 'graphframes:graphframes:0.8.3-spark3.5-s_2.13') \
        .config("spark.jars.repositories","https://repos.spark-packages.org/") \
        .getOrCreate()

    # Load data
    # --------
    # friends_df, likes_df, hashtags_df


    friends_df = spark.read.jdbc(
        url="jdbc:mysql://localhost:3306/petsdatabase",
        table="friends",
        properties=properties
    )
    likes_df = spark.read.jdbc(
        url="jdbc:mysql://localhost:3306/petsdatabase",
        table="likes",
        properties=properties
    )
    hashtags_df = spark.read.jdbc(
        url="jdbc:mysql://localhost:3306/petsdatabase",
        table="hashtags",
        properties=properties
    )
    users_df = spark.read.jdbc(
        url="jdbc:mysql://localhost:3306/petsdatabase",
        table="users",
        properties=properties
    )
    posts_df = spark.read.jdbc(
        url="jdbc:mysql://localhost:3306/petsdatabase",
        table="posts",
        properties=properties
    )
    
    # ^^^^^^^^


    # Define Vertices and Edges to create Graph

    vertices = users_df.select(col("user_id").alias("id"), lit("user").alias("type")).unionByName(
        posts_df.select(col("post_id").alias("id"), lit("post").alias("type"))
    )

    edges = likes_df.select(
        col("liker_id").alias("src"), 
        col("post_id").alias("dst"), 
        lit("like").alias("relationship")
    ).unionByName(
        friends_df.select(
            col("follower").alias("src"), 
            col("followed").alias("dst"), 
            lit("friend").alias("relationship")
        )
    )
    graph = GraphFrame(vertices, edges)

    #Absorption:

    def normalize_weights(edges, relationship_type, total_weight):
        """
        Normalize weights for edges based on the specified relationship type and total weight allowed.
        """
        # Filter and calculate new weights
        filtered_edges = edges.filter(col("relationship") == relationship_type)
        total_weights = filtered_edges.groupBy("src").agg(_sum("weight").alias("total_weight"))
        normalized_edges = filtered_edges.join(total_weights, "src").select(
            col("src"), 
            col("dst"), 
            (col("weight") / col("total_weight") * total_weight).alias("weight"),
            col("relationship")
        )
        return normalized_edges

    def update_vertex_weights(vertices, edges):
        """
        Update vertex weights based on the normalized edge weights.
        """
        new_weights = edges.join(vertices, edges.src == vertices.id) \
                        .select(col("dst"), (col("weight") * col("vertices.weight")).alias("contributed_weight")) \
                        .groupBy("dst").agg(_sum("contributed_weight").alias("new_weight"))
        
        total_weight = new_weights.select(_sum("new_weight")).first()[0]
        normalized_vertices = new_weights.select(col("dst").alias("id"), (col("new_weight") / total_weight).alias("weight"))
        return normalized_vertices

    def run_adsorption(graph, max_iterations=15, convergence_threshold=0.01):
        """
        Run the adsorption algorithm with convergence checking.
        """
        vertices = graph.vertices.withColumnRenamed("weight", "prev_weight")
        for i in range(max_iterations):
            # Normalize weights for each relationship type
            u_h_edges = normalize_weights(graph.edges, 'interest', 0.3)
            u_p_edges = normalize_weights(graph.edges, 'like', 0.4)
            u_u_edges = normalize_weights(graph.edges, 'friend', 0.3)

            # Combine all edges back into the graph
            all_edges = u_h_edges.union(u_p_edges).union(u_u_edges)
            graph = GraphFrame(vertices, all_edges)

            # Update vertex weights
            updated_vertices = update_vertex_weights(vertices, all_edges)
            joined_vertices = updated_vertices.join(vertices, "id").select(
                updated_vertices["*"], 
                abs(updated_vertices["weight"] - vertices["prev_weight"]).alias("weight_diff")
            )

            # Check for convergence
            max_diff = joined_vertices.select(_max("weight_diff")).first()[0]
            if max_diff < convergence_threshold:
                print(f"Convergence reached after {i+1} iterations.")
                return joined_vertices.drop("weight_diff")

            # Prepare for the next iteration
            vertices = joined_vertices.drop("weight_diff").withColumnRenamed("weight", "prev_weight")

        return vertices.drop("prev_weight")

    final_vertices = run_adsorption(graph)
    final_vertices.show()


    # Loading Data Back
    # Create this table in create_tables.js
    '''
    //TODO: Create postRank table (SQL Maybe)
    var q17 = db.create_tables('CREATE TABLE IF NOT EXISTS ranked_posts ( \
        post_id INT PRIMARY KEY, \
        rank_score DOUBLE, \
        last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, \
        FOREIGN KEY (post_id) REFERENCES posts(post_id) \
        );')

    Modify this accordlingly too:

    return await Promise.all([q1, q2, q3, q4, q5, q6, q7, q8, q9, q10, q11, q14, q15, q16, q17]);

    # Assuming 'final_vertices' contains the final ranking results with columns 'id', 'rank_score'
    # Add a current timestamp to each row
    final_rankings = final_vertices.select(
        col("id").alias("post_id"),
        col("rank_score"),
        current_timestamp().alias("last_updated")
    )

    # Sort the DataFrame by rank_score in descending order
    final_rankings_sorted = final_rankings.orderBy(col("rank_score").desc())

    # Write the results to the ranked_posts table
    final_rankings_sorted.write.format("jdbc").options(
        url="jdbc:mysql://localhost:3306/petsdatabase",
        table="ranked_posts",
        properties=properties
    ).mode("overwrite").save()

    spark.stop()
    '''

main()