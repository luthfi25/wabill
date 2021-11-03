const { WAConnection, MessageType, Mimetype } = require("@adiwajshing/baileys")
const fs = require("fs")
const http = require("http")
const qrcode = require("qrcode")
const express = require("express")
const socketIO = require("socket.io")
const path = require("path")
const multer = require("multer") //every multer implementation is related to image upload function

const port = 8000 || process.env.PORT
const wa = new WAConnection()
wa.version = [3, 3234, 9]
const app = express()
const server = http.createServer(app)
const io = socketIO(server)
const handleError = (err, res) => {
	res
	.status(500)
	.contentType("text/plain")
	.end("Oops! Something went wrong!");
};

const upload = multer({
	dest: "/images"
});

wa.connectOptions.alwaysUseTakeover = false

app.use(express.json())
app.use(express.urlencoded({
  extended: true
}))
app.use("/assets", express.static(__dirname + "/client/assets"))
//images folder will contain images to be sent to customer
app.use("/images", express.static(__dirname + "/images"))

app.get("/", (req, res) => {
	res.sendFile("./client/server.html", {
		root: __dirname
	})
})

app.get("/client", (req, res) => {
	res.sendFile("./client/index.html", {
		root: __dirname
	})
})

io.on("connection", async socket => {
	socket.emit("log", "Connecting...")

	wa.on("qr", qr => {
		qrcode.toDataURL(qr, (err, url) => {
			socket.emit("qr", url)
			socket.emit("log", "QR Code received, please scan!")
		})
	})

	wa.on("open", res => {
		socket.emit("qrstatus", "./assets/check.svg")
		socket.emit("log", "WhatsApp terhubung!")
		socket.emit("log", res)
	})

	wa.on("close", res => {
		socket.emit("log", "WhatsApp terputus!")
		socket.emit("log", res)
	})

	// wa.on('chat-update', async chat => {
	// 	if (chat.hasNewMessage) {
	// 		const m = chat.messages.all()[0]
	// 		console.log(m)
	// 		if (!m.key.fromMe) {
	// 			await wa.sendMessage (m.key.remoteJid, 'masih nub, belum tau apa apa (人 •͈ᴗ•͈)', MessageType.text)
	// 		}
	// 	}
	// })

	switch (wa.state) {
		case "close":
			await wa.connect()
			break
		case "open":
			socket.emit("qrstatus", "./assets/check.svg")
			socket.emit("log", "WhatsApp terhubung!")
			break
		default:
			socket.emit("log", wa.state)
	}
})

app.post('/send-message', async (req, res) => {
  const message = req.body.message
  const number = req.body.number
  const image = req.body.image ? req.body.image : null

  if (wa.state === "open") {
		const exists = await wa.isOnWhatsApp(number)

		if (exists) {
			//kirim wabill menggunakan messagetype.image jika ada gambar
			if(image){
				wa.sendMessage(exists.jid, { url: 'images/'+image }, MessageType.image, { mimetype: Mimetype.jpeg, caption: message })
				.then(result => {
					res.status(200).json({
						status: true,
						response: result
					})
				})
				.catch(err => {
					res.status(500).json({
						status: false,
						response: err
					})
				})
			} else {
				wa.sendMessage(exists.jid, message, MessageType.text)
				.then(result => {
					res.status(200).json({
						status: true,
						response: result
					})
				})
				.catch(err => {
					res.status(500).json({
						status: false,
						response: err
					})
				})
			}
		} else {
	    res.status(500).json({
	      status: false,
	      response: `Nomor ${number} tidak terdaftar.`
	    })
		}
  } else {
  	res.status(500).json({
      status: false,
      response: `WhatsApp belum terhubung.`
    })
  }
})

app.post("/upload", upload.single("file"), (req, res) => {
		const tempPath = req.file.path;
		const targetPath = path.join(__dirname, "/images/"+req.file.originalname);

		fs.rename(tempPath, targetPath, err => {
			if (err) return handleError(err, res);

			res.status(200).json({
				status: true,
				response: result
			})
		})
	}
)

server.listen(port, () => {
    console.log(`Server berjalan di http://localhost:${port}`)
    console.log(`Aplikasi Client di http://localhost:${port}/client`)
})