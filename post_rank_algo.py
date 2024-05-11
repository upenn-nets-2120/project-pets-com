from pyspark.sql import SparkSession
from pyspark.sql.functions import count, col, lit, when, concat
from pyspark.sql import functions as F
import os
import sys

def main():

    mysql_jar_path = "mysql-connector-j-8.4.0.jar"
    os.environ["PYSPARK_SUBMIT_ARGS"] = f"--jars {mysql_jar_path} pyspark-shell"

    properties = {
        "user": "admin",
        "password": "rds-password",
        "driver": "com.mysql.jdbc.Driver",
        "spark.jars.repositories":"https://repos.spark-packages.org/"
    }

    spark = SparkSession.builder \
        .appName("Post Ranking") \
        .config("spark.jars", "mysql-connector-j-8.4.0.jar") \
        .getOrCreate()

    # Load data
    # --------

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
    hash_user = hashtags_df.select("hashtag", "follower_id").dropna()
    hash_user = hash_user.withColumn("follower_id", F.format_string("user_%d", "follower_id"))

    hash_post = hashtags_df.select("hashtag", "post_id").dropna()
    hash_post = hash_post.withColumn("post_id", F.format_string("post_%d", "post_id"))

    # For user, hashtag
    hash_user_grouped = hash_user.groupBy(
        "follower_id").agg(count("*").alias("count"))
    hash_user_grouped_list = hash_user_grouped.collect()
    user_hash_dict = {}
    for row in hash_user_grouped_list:
        user_hash_dict[row['follower_id']] = row["count"]
    #print("Hashtags used by user",user_hash_dict)

    # For users and posts
    user_post_grouped = likes_df.groupBy(
        "liker_id").agg(count("*").alias("count"))
    user_post_list = user_post_grouped.collect()
    user_post_dict = {}
    for row in user_post_list:
        user_post_dict[row['liker_id']] = row["count"]
    #print("Posts liked by user",user_post_dict)

    # For users and other users
    user_user_grouped = friends_df.groupBy(
        "follower").agg(count("*").alias("count"))
    user_user_list = user_user_grouped.collect()
    user_user_dict = {}
    for row in user_user_list:
        user_user_dict[row["follower"]] = row["count"]
    #print("Followers by users",user_user_dict)

    # For hashtags and all other edges
    h_user = hash_user.withColumn("other", when(
        col("follower_id").isNotNull(), col("follower_id")).otherwise(lit(None)))
    h_post = hash_post.withColumn("other", when(
        col("post_id").isNotNull(), col("post_id")).otherwise(lit(None)))
    h_user = h_user.drop("follower_id")
    h_post = h_post.drop("post_id")
    concatenated_df = h_user.unionAll(h_post)
    c_df_user = h_user
    c_df_post = h_post

    hash_grouped = concatenated_df.groupBy(
        "hashtag").agg(count("*").alias("count"))
    hash_list = hash_grouped.collect()
    hash_dict = {}
    for row in hash_list:
        hash_dict[row["hashtag"]] = row["count"]
    #print("References by hashtags",hash_dict)

    # broadcast dictionaries:
    b_user_hash_dict = spark.sparkContext.broadcast(user_hash_dict)
    b_user_post_dict = spark.sparkContext.broadcast(user_post_dict)
    b_user_user_dict = spark.sparkContext.broadcast(user_user_dict)
    b_hash_dict = spark.sparkContext.broadcast(hash_dict)

    # Making udfs:

    def user_hash_weights(follower_id):
        return 1/user_hash_dict.get(follower_id, 10000)*0.3

    def user_post_weights(liker_id):
        return 1/user_post_dict.get(liker_id, 10000)*0.4

    def user_user_weights(follower):
        return 1/user_user_dict.get(follower, 10000)*0.3

    def hash_weights(hashtag):
        return 1/hash_dict.get(hashtag, 10000)

    user_hash_udf = F.udf(user_hash_weights)
    user_post_udf = F.udf(user_post_weights)
    user_user_udf = F.udf(user_user_weights)
    hash_udf = F.udf(hash_weights)

    # Add weights:
    hash_user = hash_user.withColumn(
        "weight", user_hash_udf(F.col("follower_id")))
    hash_user.show()

    likes_df = likes_df.withColumn("weight", user_post_udf(F.col("liker_id")))
    likes_df = likes_df.withColumn("liker_id", F.format_string("user_%d", "liker_id"))
    likes_df = likes_df.withColumn("post_id", F.format_string("post_%d","post_id"))
    likes_df.show()

    friends_df = friends_df.withColumn(
        "weight", user_user_udf(F.col("follower")))
    friends_df = friends_df.withColumn("follower", F.format_string("user_%d", "follower"))
    friends_df = friends_df.withColumn("followed", F.format_string("user_%d", "followed"))
    friends_df.show()

    c_df_user = c_df_user.withColumn(
        "weight", hash_udf(F.col("hashtag")))
    c_df_post = c_df_post.withColumn(
        "weight", hash_udf(F.col("hashtag")))
    c_df_user.show()
    c_df_post.show()

    vertices = users_df.select(col("user_id").alias("id"), lit("user").alias("type")).unionByName(
            posts_df.select(col("post_id").alias("id"), lit("post").alias("type"))
        )
    vertices = hash_user.select(col("follower_id").alias("id"), lit("user").alias("type"), lit(1).alias("value")).unionByName(
        likes_df.select(col("liker_id").alias("id"),lit("user").alias("type"), lit(1).alias("value")).unionByName(
            friends_df.select(col("follower").alias("id"),lit("user").alias("type"), lit(1).alias("value")).unionByName(
                friends_df.select(col("followed").alias("id"),lit("user").alias("type"), lit(1).alias("value")).unionByName(
                    likes_df.select(col("post_id").alias("id"),lit("post").alias("type"), lit(0).alias('value')).unionByName(
                        c_df_user.select(col("hashtag").alias("id"),lit("hashtag").alias("type"), lit(0).alias('value')).unionByName(
                            hash_user.select(col("hashtag").alias("id"), lit("hashtag").alias("type"), lit(0).alias('value')).unionByName(
                                c_df_user.select(col("other").alias("id"),lit("user").alias("type"), lit(1).alias('value')).unionByName(
                                    c_df_post.select(col("hashtag").alias("id"),lit("hashtag").alias("type"), lit(0).alias('value')).unionByName(
                                        c_df_post.select(col("other").alias("id"),lit("post").alias("type"), lit(0).alias('value'))
                                    )
                                )
                            )
                        )
                    )
                )
            )
        )
    )
    edges = hash_user.select(
        col("follower_id").alias("src"),col("hashtag").alias("dst"),col("weight")
    ).unionByName(
        hash_user.select(
            col("hashtag").alias("src"),col("follower_id").alias("dst"),col("weight")
        )
    ).unionByName(
        likes_df.select(
            col("post_id").alias("src"),col("liker_id").alias("dst"),col("weight")
        )
    ).unionByName(
        likes_df.select(
            col("liker_id").alias("src"),col("post_id").alias("dst"),col("weight")
        )
    ).unionByName(
        friends_df.select(
            col("followed").alias("src"),col("follower").alias("dst"),col("weight")
        )
    ).unionByName(
        friends_df.select(
            col("follower").alias("src"),col("followed").alias("dst"),col("weight")
        )
    ).unionByName(
        c_df_user.select(
            col("other").alias("src"),col("hashtag").alias("dst"),col("weight")
        )
    ).unionByName(
        c_df_user.select(
            col("other").alias("dst"),col("hashtag").alias("src"),col("weight")
        )
    ).unionByName(
        c_df_post.select(
            col("other").alias("src"),col("hashtag").alias("dst"),col("weight")
        )
    ).unionByName(
        c_df_post.select(
            col("other").alias("dst"),col("hashtag").alias("src"),col("weight")
        )
    )

    vertices.where(vertices.type=='post').show(200,False)
    edges.show(200,False)

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




# Split out hash
# tag into its components
# Add edges in the other direction
# Group by key to get weights for each node
# Normalize weights
# Series of joins to calculate new weights
# Done 15 times
# Upload to SQL

# GraphFrames and PageRank
# --------
'''
from graphframes import GraphFrame

vertices = posts_df.selectExpr("post_id as id")
edges = likes_df.selectExpr("liker_id as src", "post_id as dst", "'like' as action").union(
    comments_df.selectExpr("commenter_id as src",
                            "post_id as dst", "'comment' as action")
)

graph = GraphFrame(vertices, edges)
# ^^^^^^^^

# Saving results
# --------
results = graph.pageRank(resetProbability=0.15, maxIter=10)
ranked_posts = results.vertices.select(
    "id", "pagerank").orderBy("pagerank", ascending=False)

ranked_posts.write.format("jdbc") \
    .option("url", "jdbc:mysql://localhost:3306/petsdatabase") \
    .option("dbtable", "postRank") \
    .option("user", "admin") \
    .option("password", "yourpassword") \
    .mode("overwrite") \
    .save()
# ^^^^^^^^
'''


main()


