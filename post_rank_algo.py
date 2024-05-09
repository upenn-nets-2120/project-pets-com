from pyspark.sql import SparkSession
from graphframes import GraphFrame

def main():
    spark = SparkSession.builder \
        .appName("Post Ranking") \
        .config("spark.some.config.option", "some-value") \
        .getOrCreate()

    # Load data
    #--------
    spark = SparkSession.builder \
        .appName("Post Ranking") \
        .config("spark.jars", "/path/to/mysql-connector-java.jar") \
        .getOrCreate()
    properties = {
        "user": "youruser",
        "password": "yourpassword",
        "driver": "com.mysql.cj.jdbc.Driver"
    }
    
    posts_df = spark.read.jdbc(
        url="jdbc:mysql://localhost:3306/petsdatabase",
        table="posts",
        properties=properties
    )
    likes_df = spark.read.jdbc(
        url="jdbc:mysql://localhost:3306/petsdatabase",
        table="likes",
        properties=properties
    )
    comments_df = spark.read.jdbc(
        url="jdbc:mysql://localhost:3306/petsdatabase",
        table="comments",
        properties=properties
    )
    #^^^^^^^^

    # GraphFrames and PageRank
    #--------
    from graphframes import GraphFrame

    vertices = posts_df.selectExpr("post_id as id")
    edges = likes_df.selectExpr("liker_id as src", "post_id as dst", "'like' as action").union(
        comments_df.selectExpr("commenter_id as src", "post_id as dst", "'comment' as action")
    )

    graph = GraphFrame(vertices, edges)
    #^^^^^^^^

    # Saving results
    #--------
    results = graph.pageRank(resetProbability=0.15, maxIter=10)
    ranked_posts = results.vertices.select("id", "pagerank").orderBy("pagerank", ascending=False)
    
    ranked_posts.write.format("jdbc") \
    .option("url", "jdbc:mysql://localhost:3306/petsdatabase") \
    .option("dbtable", "postRank") \
    .option("user", "youruser") \
    .option("password", "yourpassword") \
    .mode("overwrite") \
    .save()
    #^^^^^^^^
    
    
    
    
    
    
    
    
    #Implementation 2 (based on current create table):
    
from pyspark.sql import SparkSession
from graphframes import GraphFrame

# Initialize Spark Session with MySQL JDBC
spark = SparkSession.builder \
    .appName("Post Ranking") \
    .config("spark.jars.packages", "graphframes:graphframes:0.8.1-spark3.0-s_2.12,mysql:mysql-connector-java:8.0.26") \
    .getOrCreate()

# Establishing JDBC connection properties
url = "jdbc:mysql://localhost:3306/petsdatabase"
properties = {
    "user": "youruser",
    "password": "yourpassword",
    "driver": "com.mysql.cj.jdbc.Driver"
}

# Load posts data, assuming already available in DataFrame 'posts_df'
posts_df = spark.read.jdbc(url=url, table="posts", properties=properties)

# Assuming 'edges' DataFrame is also set up, linking posts to interactions
# Example setup (you will need to adapt this based on your actual interaction data)
edges_df = spark.read.jdbc(url=url, table="interactions", properties=properties)  # This needs correct table and logic

# Create GraphFrame
g = GraphFrame(posts_df, edges_df)

# Calculate PageRank
results = g.pageRank(resetProbability=0.15, maxIter=10)

# Prepare data for insertion into postRank
rank_updates = results.vertices.select(
    col("id").alias("post_id"), 
    col("pagerank").alias("rank_score")
)

# Write back to MySQL
rank_updates.write \
    .format("jdbc") \
    .option("url", url) \
    .option("dbtable", "postRank") \
    .option("user", properties["user"]) \
    .option("password", properties["password"]) \
    .mode("overwrite") \
    .save()



