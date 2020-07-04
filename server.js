// A really basic web server that allows you to serve images
// at certain sizes via URLS
// so just do http://localhost:8888/images/blah.jpg?width=240
const http = require("http")
const url = require("url")
const path = require("path")
const fs = require("fs")
const { readdir } = fs.promises
const colors = require('colors')
const imageFactory = require('./make-images')
const port = process.argv[2] || 8888

const contentTypesByExtension = {
    '.css': "text/css",
    '.html': "text/html",
    '.js': "text/javascript",
    '.txt': "text/plain"
}

const styles = `<link rel="stylesheet" href="/server.css" type="text/css">`

const createHeader = (filePath) => {
    
    const headers = {}
    const contentType = contentTypesByExtension[path.extname(filePath)]
    if (contentType)
    {
        headers["Content-Type"] = contentType
    } 
    return headers
}

const server = http.createServer( async function(request, response) {

    try{
        const requested = url.parse(request.url)
        const uri = requested.pathname
        let filePath = path.join(process.cwd(), uri)
        
        //console.log({uri, parameters,options,requested, href:requested.href})
        // console.log("uri", {uri }, {poop, params:requested.searchParams, exists:fs.existsSync(filePath), isDir:fs.statSync(filePath).isDirectory(), options})
        //console.log("Request", { request })
        //console.log("filePath", { filePath})

        // if it is a directory, list the contents!
        if (fs.statSync(filePath).isDirectory())
        {
            // Check to see if this is a directory, in which case grab the index file
            //filePath = path.join( filePath, '/index.html' )

            // or TODO: fetch the directory listing...
            const folder = "./images/"
            //path.resolve('./' , uri)
            // filePath
            const folderContents = await readdir(folder, {withFileTypes: true})
            response.writeHead(200,  {"Content-Type": contentTypesByExtension['.html'] })
            
            // console.log( `Folder contents ${folder}`.red )
            let listing = `${styles}<h1>Folder ${folder}</h1><ul>`
            folderContents.forEach( content => {
                const location = path.join( folder, content.name )
                // test to see if it is a sub dir and if so loop again...?
                const isDir = fs.statSync(location).isDirectory()

                if (isDir)
                {
                    listing += `<li class="dir"><a href="${content.name}">${content.name}</a></li>`
                    
                }else{
                    // This is the original file
                    listing += `<li class="file"><a href="${content.name}"><img src="${content.name}">${content.name}</a>`
                    
                        // But to make for a nicer UI, we can add some shortcuts here too
                        // Convert to WebP
                        listing += `<ul class="sub-menu">`
                            listing += `<li><a href="${content.name}?format=webp">Convert to WebP</a></li>`
                            listing += `<li><a href="${content.name}?format=jpg">Convert to Jpeg</a></li>`
                            listing += `<li><a href="${content.name}?format=png">Convert to PNG</a></li>`
                        listing += `</ul>`
                    listing += `</li>`
                    
    
                }
                


                //console.log( `${content.name}`.red )
            })

            listing += `</ul>`
            response.write( listing )
            console.log( `Folder contains ${folderContents.length} files`.red )
            
        } else if ( !fs.existsSync(filePath) ) {

            // this file doesn't exist!!!
            // TODO: Create it if the underlying one has a source image?
            response.writeHead(404, {"Content-Type": contentTypesByExtension['.txt'] })
            // TODO: Show file path fuzzy for similar sounding files to select from
            response.write(`404 Not Found\n${filePath}`)
           
        }else{

            // Handle any resizes and transcodes...
            const hasSettings = requested.search

            // determine any URL options from after a .image file
            if (hasSettings)
            {
                const sizes = {}
                const parameters = new URLSearchParams(requested.query)
                let format = path.extname(filePath)
                
                for (const [key, value] of parameters.entries()) 
                {
                    // params can be any of the following to set the dimensions
                    // width, height, size
                    switch( key.toLowerCase() )
                    {
                        case "width": 
                        case "height": 
                        case "size": 
                            sizes[key] = value
                            break
                        case "format":
                            format = value
                    }   
                    sizes[key] = value
                }

                //console.log("Attempting to transcode image", format, requested.pathname, options)
                const images = await imageFactory.convertImage( filePath, [format], [sizes] )
                const image = images[0]
                //console.log( `Image ${filePath} transcoded ${requested.pathname}`.green.inverse )
                
                // overwrite expected file path
                filePath = image.path

                // need to redirect to this new file
                console.log(`Redirect ${filePath}`.green)
                //"https://" + req.headers['host'] + req.url 
                response.writeHead(301, { "Location": `${image.name}`})
            
            }else{

                // direct access of the file
                // regular data file read
                const data = fs.readFileSync(filePath, 'binary')
                // fetch the correct header for this file type
                const headers = createHeader(filePath)
                  
                console.log(`Serving direct ${filePath}`.green)

                response.writeHead(200, headers)
                response.write(data, "binary")  
            }
        }

        // end the response
        response.end()

    } catch (exception) {

        console.error(exception.stack)
        response.writeHead(500, {"Content-Type": contentTypesByExtension['.txt'] })
        response.write( `${styles}${exception.toString()}` )
        response.end()
    }
   
})

server.on('error', error => {
    console.log( `ERROR accessing ${error}`.red )
})

server.listen( port, data => {
    console.log( `server.listen http://localhost:${port}/ \n`, data)
})

console.log( `Image API server running at :\nhttp://localhost:${port}/ \nCTRL + C to shutdown`.green )