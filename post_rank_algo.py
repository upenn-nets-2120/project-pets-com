from pyspark.sql import SparkSession
from graphframes import GraphFrame
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
        .config("spark.some.config.option", "some-value") \
        .getOrCreate()

    # Load data
    # --------
    spark = SparkSession.builder \
        .appName("Post Ranking") \
        .config("spark.jars", "/path/to/mysql-connector-java.jar") \
        .getOrCreate()

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
    # ^^^^^^^^

    print(posts_df)

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
