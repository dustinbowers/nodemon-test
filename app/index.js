'use strict'

const express = require('express')
const request = require('request')
const url = require('url')
const ejs = require('ejs')
const credentials = require('./credentials.json')
const redis = require('redis');
const client = redis.createClient("6379", process.env.REDIS_URL);

const { PORT = '3000' } = process.env
const app = express()
const client_id = credentials.client_id
const client_secret = credentials.client_secret;
const client_authorization = (new Buffer(client_id + ':' + client_secret)).toString('base64');

app.set('view engine', 'ejs');
let errHandler = function(err) { console.log(err); }

function get_access_token() {
    console.log('Attempting to fetch access token');

    return new Promise((resolve, reject) => {
        request.post('https://accounts.spotify.com/api/token', {
            form: {
                grant_type: 'client_credentials'
            },
            headers: {
                'Authorization': 'Basic ' + client_authorization
            },
        }, (error, res, body) => {
            console.log(body);
            if (error) {
                reject(error);
            } else {
                resolve(body);
            }
            return
        });
    });
}

function get_track(access_token, track_id) {
    console.log('attempting to get a track: ' + track_id + ' using token: ' + access_token);

    return new Promise((resolve, reject) => {
       request.get('https://api.spotify.com/v1/tracks/' + track_id, {
            headers: {
                'Authorization': 'Bearer ' + access_token
            }
        }, (error, res, body) => {
            if (error) {
                reject(error);
            } else { 
                console.log('body: ' + body);
                console.log('res: ' + JSON.stringify(res));
                resolve(body);
            }
        });
    });
}

app.get('/redis', (request, response) => {
    client.get('testing', (err, reply) => {
        if (reply) { 
            console.log('testing was already set to: ' + reply);
            response.send('was already set to ' + reply);
        } else {
            client.set('testing', 'cached!');
            response.send('just set the testing field in redis');
        }
    });
});

app.get('/', (request, response) => {
    response.render('pages/index');

});

app.get('/about', (request, response) => {
    response.render('pages/about');
});

app.get('/track/:id', (request, response) => {
    
    let id = request.params.id;

    client.get('/track/'+id, (err, reply) => {
        if (err) {
            throw err;
        }
        if (reply) {
            response.render('pages/track', JSON.parse(reply));
        }
    });

    get_access_token()
        .then(JSON.parse, errHandler)
        .then(function(body) {

            let access_token = body.access_token;
            get_track(access_token, id)
                .then((track) => { 
                    let data = { track: JSON.parse(track), name: 'sup' };
                    client.set('/track/'+id, JSON.stringify(data), (err)=>{console.log(err);});
                    response.render('pages/track', data);
                    //response.send(track); 
                }, function(err) { errHandler(err) });
         }, function(err) { errHandler(err) });
});

app.use((request, response, next) => {
    response.render('pages/404.ejs');
})

app.listen(PORT)
