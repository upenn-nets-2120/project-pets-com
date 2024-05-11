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

    # Iterate the algorithm

    # user nodes, hash nodes, post nodes,

    # udf need to be sum of weights not just ...

    send_user = hash_user
    send_post = likes_df
    send_friends = friends_df

    new_hash_user = concatenated_df.join(
        send_user,
        concatenated_df["other"] == send_user["follower_id"]
    ).withColumn(
        "new_weight",
        col("concatenate_df.weight") * col("send_users.weight"))

    new_hash_post = concatenated_df.join(
        send_post,
        concatenated_df["other"] == send_user["follower_id"]
    ).withColumn(
        "new_weight",
        col("concatenate_df.weight") * col("send_users.weight"))

    # Return something at end with just rows of userid, post, and weight
    # Then just put that into feed database
    # Draw that from feed route - where user_id = user_id
    # order by weight
    # union on the posts of zero weight
    # order by weight


# Split out hashtag into its components
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


 