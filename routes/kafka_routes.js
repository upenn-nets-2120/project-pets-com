const express = require('express');
const { Kafka } = require('kafkajs');
const dbsingleton = require('../models/db_access.js');

const db = dbsingleton;

const kafka = new Kafka({
    clientId: "nets2120-g23",
    brokers: ["localhost:9092"]
});

const producer = kafka.producer()

const sendMessage = async(username, source_site, post_uuid_within_site, post_text, content_type) => {
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
    var insertPostQuery =  `
    INSERT INTO posts (author_id, title, captions) 
    VALUES (${id}, '${title}', '${captions}');
    `;
    try {
        await db.insert_items(insertPostQuery);
        console.log("INSERTED ")
        console.log(insertPostQuery)
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
            let m = JSON.parse(message.value)
            console.log(m)
            if(topic == "Twitter-Kafka"){
                let mess = null
                if(m.text){
                    mess = m.text
                }
                cPost(14, null, mess);
                


            } else if(topic == "FederatedPosts"){
                let title = null
                if(m.username && m.source_site){
                    title = m.source_site + "-" + m.username
                }
                let mess = null
                if(m.post_text){
                    mess = m.post_text
                }
                cPost(15, title, mess );
            }

        }
    })
}

module.exports = {runConsumer, sendMessage}


