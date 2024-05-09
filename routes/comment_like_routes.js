const dbsingleton = require('../models/db_access.js');
const helper = require('../routes/route_helper.js');

const db = dbsingleton;

var addLike = async function(req, res) {

    const post = req.body.post_id;
    const username = req.params.username
    const user_id = req.session.user_id;

    console.log("LIKEEE ... " + username + "  " + user_id)
    console.log(helper.isLoggedIn(req, username), post, user_id)


    if (!helper.isLoggedIn(req, username) || post==null || user_id == null) {
        return res.status(403).json( {error: 'Not logged in.'} );
    }
    try{

    const results = await db.send_sql(`SELECT * FROM  likes WHERE post_id = ${post} AND liker_id = ${user_id}`)
    if(results.length == 0){
        
        const addLikes = `INSERT INTO likes (post_id, liker_id) VALUES (${post}, ${user_id})`

        console.log(addLikes)

            const results = await db.send_sql(addLikes)
            console.log(results)
            return res.status(200).json({results: results});
        }} catch(error){
            console.log(error)
            return res.status(500).json({error: 'Error querying database.'});
        }
    }
   

//WE SHOULD BULK GET LIKES WHEN WE GET FEED - BUT THIS WILL DO FOR NOW
//ALSO SHOULD PROBABLY GET LIKE COUNT!

var getLike = async function(req, res){
    const post = req.params.post_id;
    const username = req.params.username
    console.log(username)
    const user_id = req.session.user_id;
    if (!helper.isLoggedIn(req, username) || post==null || user_id == null) {
        return res.status(403).json( {error: 'Not logged in.'} );
    }

    try{

    const results = await db.send_sql(`SELECT * FROM  likes WHERE post_id = ${post} AND liker_id = ${user_id}`)
    if(results.length == 0){
        return res.status(200).json({results: false});
    } else {
        return res.status(200).json({results: true});
    }
        } catch(error){
            console.log(error)
            return res.status(500).json({error: 'Error querying database.'});
        }
    }

var unLike = async function(req, res) {

        const post = req.body.post_id;
        const user_id = req.session.user_id;
        const username = req.params.username
        console.log(username)
        if (!helper.isLoggedIn(req, username) || post==null || user_id == null) {
            return res.status(403).json( {error: 'Not logged in.'} );
        }
        try{
            const results = await db.send_sql(`DELETE FROM likes WHERE post_id = ${post} AND liker_id = ${user_id}`)
            return res.status(200);
        } catch(error){
            console.log(error)
            return res.status(500).json({error: 'Error querying database.'});
        }
     }

var addComment = async function(req, res) {

        const post = req.body.post_id;
        const username = req.params.username
        const user_id = req.session.user_id;
        const comment = req.body.comment
    
        if (!helper.isLoggedIn(req, username) || post==null || user_id == null) {
            return res.status(403).json( {error: 'Not logged in.'} );
        }
        if(comment.length > 225){
            return res.status(401).json({error: "Comment is too long"})
        }


        try{
            
        const addComment = `INSERT INTO comments (post_id, commenter_id, comment) VALUES (${post}, ${user_id}, '${comment}')`
        const regex = /#(\w+)/g;
        
        
        const results = await db.send_sql(addComment)

      
        const getId = await db.send_sql(`SELECT comment_id FROM comments WHERE post_id = ${post} AND commenter_id = ${user_id} AND comment = '${comment}'`)
        const matches = comment.match(regex)
        matches?.map(async match => {
            const q = `INSERT INTO hashtags (hashtag, post_id, comment_id, follower_id) VALUES ('${match}', ${post}, ${getId[0].comment_id}, ${user_id}) `

            await db.send_sql( q)  
             })
                return res.status(200).json({results: results});
            } catch(error){
                console.log(error)
                return res.status(500).json({error: 'Error querying database.'});
            }
        
    }


    var getComments = async function(req, res){
        const post = req.params.post_id;
        const username = req.params.username
        const user_id = req.session.user_id;
        if (!helper.isLoggedIn(req, username) || post==null || user_id == null) {
            return res.status(403).json( {error: 'Not logged in.'} );
        }
    
        try{
    
        const results = await db.send_sql(`SELECT comment FROM  comments WHERE post_id = ${post}`)
        return res.status(200).json({results: results})
            } catch(error){
                console.log(error)
                return res.status(500).json({error: 'Error querying database.'});
            }
        }

var topHashtags = async function(req, res){
    try {
        const results = await db.send_sql(`
        SELECT hashtag
        FROM hashtags
        GROUP BY hashtag
        ORDER BY COUNT(*) DESC
        LIMIT 10;
        `)
        return res.status(200).json({results: results})
    } catch(error){
        console.log(error)
        return res.status(500).json({error: 'Error querying database'})
    }
}

var getHashtags = async function(req, res){
        const username = req.params.username
        const user_id = req.session.user_id;
        if (!helper.isLoggedIn(req, username) || user_id == null) {
            return res.status(403).json( {error: 'Not logged in.'} );
        }
    
        try{
    
        const results = await db.send_sql(`SELECT hashtag FROM hashtags WHERE follower_id = ${user_id}`)
        return res.status(200).json({results: results})
            } catch(error){
                console.log(error)
                return res.status(500).json({error: 'Error querying database.'});
            }



}

var changeHashtags = async function(req, res){
    const username = req.params.username
    const hashtags = req.body.hashtags
    const user_id = req.session.user_id;

    if (!helper.isLoggedIn(req, username) || user_id == null) {
        return res.status(403).json( {error: 'Not logged in.'} );
    }
    try{
    
    const results = await db.send_sql(`SELECT hashtag FROM hashtags WHERE follower_id = ${user_id}`)
    const hashes = results.map((inp) => inp.hashtag)
    hashtags.map(async(inp) => {
        if(!hashes.include(inp)){
            await db.insert_items(`INSERT INTO hashtags (hashtag, follower_id) VALUES ('${inp.includes("#") ? inp : "#" + inp}', ${user_id} )`);
        }
    })

    hashes.map(async(inp) => {
        if(!hashtags.include(inp)){
            await db.insert_items(`DELETE FROM hashtags WHERE follower_id = ${user_id} AND hashtag = '${inp}'`);

        }
    })
    return res.status(200).json({results: results})
    } catch(error){
         console.log(error)
        return res.status(500).json({error: 'Error querying database.'});
    }


}

var otherRoutes = {
    addLike,
    getLike,
    unLike,
    addComment,
    getComments,
    topHashtags,
    getHashtags,
    changeHashtags
}
module.exports = otherRoutes