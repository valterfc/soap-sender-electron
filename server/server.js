const express = require('express');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const fs = require('fs');
const path = require("path");

const port = 7168;
const appPath = "./app-package/";
const commentFile = "./comments.json"
const app = express();
var tokenList = [];

app.use(express.static("image"));

app.get("/getLastVersion", function(req, res, next) {
	fs.readdir(appPath, function(error, files) {
		if(error) {
			res.send("Error");
			return;
		}
		let vers = [];
		for(let i=0; i<files.length; i++) {
			let file = files[i];
			if(/^soap-sender-(64|32)-V\d+\.\d+\.\d+.zip$/.test(file) === true) {
				let ver = file.replace(/^soap-sender-(64|32)-V(\d+\.\d+\.\d+).zip$/, "$2");
				vers.push(ver);
			}
		}
		if(vers.length === 0) {
			res.send("Error");
			return;
		}
		let last = vers[0];
		for(let i=0; i<vers.length; i++) {
			let v = vers[i].split(".");
			let l = last.split(".");
			if(parseInt(v[0]) > parseInt(l[0]) || parseInt(v[1]) > parseInt(l[1]) || parseInt(v[2]) > parseInt(l[2])) {
				last = vers[i];
			}
		}
		res.send(last).end();
	})
})

app.post("/postComment", bodyParser.json(), (req, res, next) => {
	let {username, comment, version} = req.body;
	if(username === undefined || comment === undefined || version === undefined) {
		res.status(402).end();
		return;
	}
	let arrs = [];
	try {
		let data = fs.readFileSync(commentFile);
		let temp = JSON.parse(data);
		if(Array.isArray(temp)) {
			arrs = temp;
		}
	}
	catch(err) {/*do nothing*/}
	arrs.push({
		'username': username,
		'comment': comment,
		'version': version,
		'time': (new Date()).toLocaleString()
	});
	fs.writeFile(commentFile, JSON.stringify(arrs, null, '\t'), (err) => {});
	res.status(200).end();
})

app.post("/soap/server_sa/", (req, res, next) => {
	let soapAction = req.headers['soapaction'];
	if(soapAction === undefined) {
		res.status(402).end();
		return;
	}
	let method, action;
	if(/^.+?[a-z0-9]+\s*:\s*\d+#[a-z0-9]+$/i.test(soapAction) === true) {
		method = soapAction.replace(/^.+?([a-z0-9]+)\s*:\s*\d+#([a-z0-9]+)$/i, '$1');
		action = soapAction.replace(/^.+?([a-z0-9]+)\s*:\s*\d+#([a-z0-9]+)$/i, '$2');
	}
	else {
		res.status(402).end();
		return;
	}
	let codes = ['402', '501', '000', '001', '0', '00'];
	let code = codes[Math.floor((Math.random())*6)];
	let payload = '';
	if(action === 'Authenticate') {
		code = '000';
	}
	else if(action === 'SOAPLogin') {
		res.cookie('jwt_local', createToken(50));
	}
	if(method === 'DeviceInfo' && action === 'GetInfo') {
		payload += '\t<Firmwareversion>1.0.3.16</Firmwareversion>\n';
		payload += '\t<SerialNumber>SOAPSENDER7568</SerialNumber>\n'
	}
	res.set('content-type', 'text/xml; charset="utf-8"');
	let str = `<?xml version="1.0" encoding="UTF-8"?><SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/">
	<SOAP-ENV:Body>
	  <m:${action}Response xmlns:m="urn:NETGEAR-ROUTER:service:${method}:1">${payload}</m:${action}Response>
	  <ResponseCode>${code}</ResponseCode>
	</SOAP-ENV:Body>
  </SOAP-ENV:Envelope>`
	res.status(200).send(str).end();
})

app.get("/currentsetting.htm", (req, res, next) => {
	let str = 'Region=PR\rModel=Example\rInternetConnectionStatus=UP\rSOAPVersion=3.29\rLoginMethod=2.0';
	res.status(200).send(str).end();
})

app.get("/getNewTool", function(req, res, next) {
	let ver = req.query.version;
	let type = req.query.type;
	let file = "soap-sender-" + type + "-V" + ver + ".zip";
	res.download(path.join(process.cwd(), appPath + file), file);
})


app.get("*", function(req, res) {
	res.sendFile(__dirname + "/index.html");
})

var server = app.listen(port, function() {
    console.log('SOAP Sender Server listening at port ' + port);
});

function getRandom() {
	do {
		var num = 48 + Math.round(Math.random() * (122 - 47));
	}
	while (!((num > 47 && num < 58) || (num > 64 && num < 91) || (num > 96 && num < 123)))

	return num;
}

function createToken(len) {
	var token = "";
	do {
		token += String.fromCharCode(getRandom());
	}
	while (token.length < len)

	return token;
}

function decodeToken(key) {
	var secret = 'GuessMe@Defeng';
	var decipher = crypto.createDecipher('aes192', secret);
	var dec = decipher.update(key, 'hex', 'utf8');
	dec += decipher.final('utf8');
	return dec;
}

function encodeToken(token) {
    var secret = 'GuessMe@Defeng';
    var cipher = crypto.createCipher('aes192', secret);
    var enc = cipher.update(token, 'utf8', 'hex');
    enc += cipher.final('hex');
    return enc;
}

function writeUserFile(data) {
    fs.writeFile('./users.json', JSON.stringify(data, null, '\t'), function(err) {
        if (err)
            return;
    });
}