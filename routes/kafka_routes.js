const express = require('express');
const { Kafka } = require('kafkajs');
const dbsingleton = require('../models/db_access.js');
const {  CompressionTypes, CompressionCodecs } = require('kafkajs')
const SnappyCodec = require('kafkajs-snappy')
 
CompressionCodecs[CompressionTypes.Snappy] = SnappyCodec
const db = dbsingleton;

const kafka = new Kafka({
    clientId: "nets2120-g23",
    brokers: ["localhost:9092"]
});

const producer = kafka.producer()

const sendMessage = async(username, source_site, post_uuid_within_site, post_text, content_type) => {
    console.log("SENDING MESSAGE!!");
    await producer.connect()
    await producer.send({
    topic: "FederatedPosts",
    messages: [{
        key: null,
        value: JSON.stringify({
        username: username,
        source_site: source_site,
        post_uuid_within_site: post_uuid_within_site,
        post_text: post_text,
        content_type: content_type
    })}]
  }).then(console.log)
  .catch(e => console.error(`[example/producer] ${e.message}`, e))

}

const consumer = kafka.consumer({ 
    groupId: "nets-2120-group-23", 
    bootstrapServers: ["localhost:9092"]
});

const cPost = async(id, title, captions) => {
    if(title){
        title = title.replace(/'/g, "''")
    }
    if(captions){
        captions = captions.replace(/'/g, "''")
    }
    var insertPostQuery =  `
    INSERT IGNORE INTO posts (author_id, title, captions) 
    VALUES (${id}, '${title}', '${captions}');
    `;
    try {
        await db.insert_items(insertPostQuery);
        const regex = /#(\w+)/g;
        const matches = captions?.match(regex)
        //NEED Post ID
        const postIDQuery = `SELECT post_id FROM posts WHERE author_id = '${id}' ${title ? ` AND title = '${title}'` : ''} ${captions ? `AND captions = '${captions}'` : ""};`;
        const result = await db.send_sql(postIDQuery);
        if(result.length > 0){
        const post_id = result[0].post_id; 
        matches?.map(async match => {
            const q = `INSERT INTO hashtags (hashtag, post_id, follower_id) VALUES ('${match}', ${post_id}, ${id}) `

            await db.send_sql( q)  
             })
        console.log("INSERTED ")
        console.log(insertPostQuery)
            }
    } catch(error) {
        console.log(error);
    }

}

const runConsumer = async () => {
    await consumer.connect();
    await consumer.subscribe({ topics: ["Twitter-Kafka", "FederatedPosts"] });

    await consumer.run({
        eachMessage: async({topic, partition, message}) => {
            console.log(message)
            let m = {}
            try{
            m = JSON.parse(message.value)
            } catch(error){
                return;
            }
            console.log(m)
            if(topic == "Twitter-Kafka"){
                let mess = null
                if(m.text){
                    mess = m.text
                }
                await cPost(14, null, mess);
                
                


            } else if(topic == "FederatedPosts"){
                let title = null
                if(m.username && m.source_site){
                    title = m.source_site + "-" + m.username
                }
                let mess = null
                if(m.post_text){
                    mess = m.post_text
                }
                if(m.source_site != "g23"){
                await cPost(15, title, mess );
                }
            }

        }
    })
}

module.exports = {runConsumer, sendMessage}


