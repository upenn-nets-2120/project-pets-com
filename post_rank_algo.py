from pyspark.sql import SparkSession
from pyspark.sql.functions import count, col, lit, when, concat, coalesce, sum, regexp_replace
from pyspark.sql import functions as F
import os
import sys
from pyspark.sql.types import FloatType


def main():

    mysql_jar_path = "mysql-connector-j-8.4.0.jar"
    os.environ["PYSPARK_SUBMIT_ARGS"] = f"--jars {mysql_jar_path} pyspark-shell"

    properties = {
        "user": "admin",
        "password": "rds-password",
        "driver": "com.mysql.jdbc.Driver",
        "spark.jars.repositories": "https://repos.spark-packages.org/"
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

    # ~~~~~~~~~~
    hash_user = hashtags_df.select("hashtag", "follower_id").dropna()
    hash_user = hash_user.withColumn(
        "follower_id", F.format_string("user_%d", "follower_id"))
    hash_user.show()

    hash_post = hashtags_df.select("hashtag", "post_id").dropna()
    hash_post = hash_post.withColumn(
        "post_id", F.format_string("post_%d", "post_id"))
    hash_post.show()

    likes_df = likes_df.withColumn(
        "liker_id", F.format_string("user_%d", "liker_id"))
    likes_df = likes_df.withColumn(
        "post_id", F.format_string("post_%d", "post_id"))
    likes_df.show()

    friends_df = friends_df.withColumn(
        "follower", F.format_string("user_%d", "follower"))
    friends_df = friends_df.withColumn(
        "followed", F.format_string("user_%d", "followed"))
    friends_df.show()

    # user -> hashtag
    hash_user_grouped = hash_user.groupBy(
        "follower_id").agg(count("*").alias("count"))
    hash_user_grouped_list = hash_user_grouped.collect()
    user_hash_dict = {}
    for row in hash_user_grouped_list:
        user_hash_dict[row['follower_id']] = row["count"]

    # user -> post
    user_post_grouped = likes_df.groupBy(
        "liker_id").agg(count("*").alias("count"))
    user_post_list = user_post_grouped.collect()
    user_post_dict = {}
    for row in user_post_list:
        user_post_dict[row['liker_id']] = row["count"]

    # user -> user
    user_user_grouped = friends_df.groupBy(
        "follower").agg(count("*").alias("count"))
    user_user_list = user_user_grouped.collect()
    user_user_dict = {}
    for row in user_user_list:
        user_user_dict[row["follower"]] = row["count"]

    # hashtag -> user, post
    h_userAndpost = hash_user.union(hash_post).distinct()
    hash_grouped = h_userAndpost.groupBy(
        "hashtag").agg(count("*").alias("count"))
    hash_list = hash_grouped.collect()
    hash_dict = {}
    for row in hash_list:
        hash_dict[row["hashtag"]] = row["count"]

    # post -> user, hashtag
    h_likesAndHash = likes_df.select("post_id").union(
        hash_post.select("post_id")).distinct()
    post_grouped = h_likesAndHash.groupBy(
        "post_id").agg(count("*").alias("count"))
    post_list = post_grouped.collect()
    post_dict = {}
    for row in post_list:
        post_dict[row["post_id"]] = row["count"]

    # Making udfs:
    def user_hash_weights(follower_id):
        return 1/user_hash_dict.get(follower_id, 10000) * 0.3

    def user_post_weights(liker_id):
        return 1/user_post_dict.get(liker_id, 10000) * 0.4

    def user_user_weights(follower):
        return 1/user_user_dict.get(follower, 10000) * 0.3

    def hash_weights(hashtag):
        return 1/hash_dict.get(hashtag, 10000)

    def post_weights(post):
        return 1/post_dict.get(post, 10000)

    user_hash_udf = F.udf(user_hash_weights)
    user_post_udf = F.udf(user_post_weights)
    user_user_udf = F.udf(user_user_weights)
    hash_udf = F.udf(hash_weights)
    post_udf = F.udf(post_weights)

    # ^^^^^^^^
    vertices = None  # vertices = (id,type), type one of [user,post,hashtag]
    edges = None  # edges = (src,dst,weight)

    # HASHTAGS
    # user follows hashtags
    hash_user = hash_user.withColumn(
        "weight_hashtag", hash_udf(col("hashtag")))
    hash_user = hash_user.withColumn(
        "weight_follower_id", user_hash_udf(col("follower_id")))

    vertices = hash_user.select(col("hashtag").alias(
        "id"), lit("hashtag").alias("type"))
    vertices = vertices.union(hash_user.select(
        col("follower_id").alias("id"), lit("user").alias("type"))).distinct()
    edges = hash_user.select(col("hashtag").alias("src"), col(
        "follower_id").alias("dst"), col("weight_hashtag").alias("weight"))
    edges = edges.union(hash_user.select(col("follower_id").alias("src"), col(
        "hashtag").alias("src"), col("weight_follower_id").alias("weight")))  # backlink

    # post includes hashtag
    hash_post = hash_post.withColumn(
        "weight_hashtag", hash_udf(col("hashtag")))
    hash_post = hash_post.withColumn(
        "weight_post_id", post_udf(col("post_id")))
    vertices = vertices.union(hash_post.select(
        col("hashtag").alias("id"), lit("hashtag").alias("type"))).distinct()
    vertices = vertices.union(hash_post.select(
        col("post_id").alias("id"), lit("post").alias("type"))).distinct()
    edges = edges.union(hash_post.select(col("hashtag").alias("src"), col(
        "post_id").alias("dst"), col("weight_hashtag").alias("weight")))
    edges = edges.union(hash_post.select(col("post_id").alias("src"), col(
        "hashtag").alias("src"), col("weight_post_id").alias("weight")))  # backlink

    # LIKES
    likes_df = likes_df.withColumn(
        "weight_liker_id", user_post_udf(col("liker_id")))
    likes_df = likes_df.withColumn(
        "weight_post_id", post_udf(col("post_id")))
    vertices = vertices.union(likes_df.select(
        col("liker_id").alias("id"), lit("user").alias("type"))).distinct()
    vertices = vertices.union(likes_df.select(
        col("post_id").alias("id"), lit("post").alias("type"))).distinct()
    edges = edges.union(likes_df.select(col("liker_id").alias("src"), col(
        "post_id").alias("dst"), col("weight_liker_id").alias("weight")))
    edges = edges.union(likes_df.select(col("post_id").alias("src"), col(
        "liker_id").alias("src"), col("weight_post_id").alias("weight")))  # backlink

    # FRIENDS
    friends_df = friends_df.withColumn(
        "weight_follower", user_user_udf(col("follower")))
    friends_df = friends_df.withColumn(
        "weight_followed", user_user_udf(col("followed")))
    vertices = vertices.union(friends_df.select(
        col("follower").alias("id"), lit("user").alias("type"))).distinct()
    vertices = vertices.union(friends_df.select(
        col("followed").alias("id"), lit("user").alias("type"))).distinct()
    edges = edges.union(friends_df.select(col("follower").alias("src"), col(
        "followed").alias("dst"), col("weight_follower").alias("weight")))
    edges = edges.union(friends_df.select(col("followed").alias("src"), col(
        "follower").alias("src"), col("weight_followed").alias("weight")))  # backlink

    state = vertices.where(vertices.type == 'user')
    state = state.withColumn("labels", col("id"))
    state = state.withColumn("value", lit(1))

    def run_adsorption(edges, state):
        """
        Run the adsorption algorithm with convergence checking.
        """

        # state has columns, id value, labels.
        for i in range(5):
            # Join state on edges
            state_edge_join = state.join(edges, state["id"] == edges["src"])
            state_edge_join = state_edge_join.select(
                col("dst").alias("id"), "value", "weight", "labels")

            # Calculate the new values for the state
            state_edge_join = state_edge_join.withColumn(
                "val", col("value") * col("weight"))
            state_edge_join = state_edge_join.drop("value", "weight")

            # Aggregate state and labels
            grouped_df = state_edge_join.groupBy(
                "id", "labels").agg(sum("val").alias("val"))

            # Get the sum to normalize values
            normalize_df = grouped_df.groupBy(
                "id").agg(sum("val").alias("sum"))

            # Normalize the values!
            grouped_normalize = grouped_df.join(
                normalize_df, grouped_df["id"] == normalize_df["id"])
            grouped_normalize = grouped_normalize.drop(normalize_df["id"])
            grouped_normalize = grouped_normalize.withColumn(
                "val", col("val")/col("sum"))

            # Get the new state!
            state = grouped_normalize.select(
                "id", col("val").alias("value"), "labels")
            print(state.count())

        return state

    final_vertices = run_adsorption(edges, state)

    types = final_vertices.join(
        vertices, final_vertices["id"] == vertices["id"])
    types = types.drop(final_vertices["id"])
    types = types.where(types.type == 'post')

    types = types.withColumn("id", regexp_replace("id", "^post_", ""))
    types = types.withColumn("labels", regexp_replace("labels", "^user_", ""))
    types = types.select(col("id").alias("post_id"), col(
        "labels").alias("user_id"), col("value").alias("rank_score"))

    types.write.jdbc(url="jdbc:mysql://localhost:3306/petsdatabase",
                     table="post_ranks", mode="overwrite", properties=properties)


main()
