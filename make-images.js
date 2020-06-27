// Types to transcode to
const TYPE_JPG = "jpg"
const TYPE_WEBP = "webp"
const TYPE_PNG = "png"
const TYPE_GIF = "gif"

// Libs
const fs = require("fs")
const sharp = require("sharp")
const path = require('path')
const colors = require('colors')
const { readdir } = fs.promises

const createFilename = (name,w,h,type) => {
    const dimensions = w && h ? `${w}x${h}` : h && !w ? `${h}` : w
    return `${name}-${dimensions}.${type}`
}

/*
WEB P
options Object ? output options
options.quality number 
quality, integer 1-100 (optional, default 80)
options.alphaQuality number
quality of alpha layer, integer 0-100 (optional, default 100)
options.nearLossless boolean
use near_lossless compression mode (optional, default false)
options.smartSubsample boolean
use high quality chroma subsampling (optional, default false)
options.reductionEffort number
level of CPU effort to reduce file size, integer 0-6 (optional, default 4)
options.force boolean
force WebP output, otherwise attempt to use input format (optional, default true)
*/
// https://sharp.pixelplumbing.com/api-output#jpeg
const defaultOptions = {
    // integer 1-100 (optional, default 80% - still looks lovely)
    quality : 80,
    // Default to writing in the same directory as the image files!
    destination : './',
    // Load the image progressively (applies for jpgs)
    progressive : false,
    // use lossless compression mode (optional, default false)
    lossless : false,
    // If an image shrinks below it's size, how to pad out the remainer
    background : { r: 255, g: 255, b: 255, alpha: 0 }
}

// This is the magic function
// Provide it with a single image file
// Choose which file types you want
// Pass in optional settings
const convertImage = async function(
        file, 
        types = [ TYPE_WEBP, TYPE_JPG ],
        sizes = [ {width:500}, {width:100}, {size:2} ],
        settings = {} 
    ) {
        
    const options = Object.assign( {}, defaultOptions, settings )

    // work out original name without suffix or path
    const name = path.basename( file, path.extname(file) )

    // create promises for all the variants and store them in here
    const promises = []
    const filenames = []

    // create the stream
    const sharpStream = sharp(file, {
        // Prevent a file error from taking them all down....
        failOnError: false
    })

    const metadata = await sharpStream.metadata()
    const aspectRatio = metadata.width / metadata.height
 
    // TODO: LOOP
    //console.log("Converting", file, types, name)
    for (let d in sizes)
    {        
        const dimensions = sizes[d]
        
        // if there is a size in the dimensions...
        if (dimensions.hasOwnProperty("size"))
        {
            dimensions.width = dimensions.width ? dimensions.width * dimensions.size : metadata.width * dimensions.size
            dimensions.height = dimensions.height ? dimensions.height * dimensions.size : metadata.height * dimensions.size
        }
        
        const sharpOptions = {

            // set the dimensions
            ...dimensions,
           
            // sharp.fit.cover: (default) Preserving aspect ratio, ensure the image covers both provided dimensions by cropping/clipping to fit.
            // sharp.fit.contain: Preserving aspect ratio, contain within both provided dimensions using "letterboxing" where necessary.
            // sharp.fit.fill: Ignore the aspect ratio of the input and stretch to both provided dimensions.
            // sharp.fit.inside: Preserving aspect ratio, resize the image to be as large as possible while ensuring its dimensions are less than or equal to both those specified.
            // sharp.fit.outside: Preserving aspect ratio, resize the image to be as small as possible while ensuring its dimensions are greater than or equal to both those specified.
            fit: sharp.fit.cover,
            //withoutEnlargement: true,

            //sharp.gravity: north, northeast, east, southeast, south, southwest, west, northwest, center or centre.
            
            // When using a fit of cover or contain, the default position is centre. Other options are:
            //sharp.position: top, right top, right, right bottom, bottom, left bottom, left, left top.
            //position: 'right top',
            
            // entropy: focus on the region with the highest Shannon entropy
            // attention: focus on the region with the highest luminance frequency, colour saturation and presence of skin tones.
            // sharp.strategy: cover only, dynamically crop using either the entropy or attention 
            //strategy: sharp.strategy.entropy,
             // kernel: sharp.kernel.nearest,

            background: options.background
        }
        
        // resize the stream.clone()
        const resizedStream = await sharpStream.resize(sharpOptions)
 
        // pause here until we have got the data
        // If we want to use something from the metadata we will have to wait...  
        const resizedMeta = await resizedStream.metadata()
        
        console.log( "resizedStream : metadata", resizedMeta, "aspectRatio", aspectRatio, "dimensions", dimensions )
        
        // now loop through the types
        for ( let t in types)
        {
            const type = types[t].toLowerCase()
            const filename = createFilename( name, resizedMeta.width, resizedMeta.height, type)
            const filePath = path.dirname(file)
            const destination = path.join( options.destination, filePath, filename )
            const resizedStreamClone = resizedStream.clone()        
        
            console.log("Destination", destination)

            filenames.push( filename )

            switch( type )
            {
                case TYPE_WEBP:
                    promises.push( resizedStreamClone.webp(options).toFile(destination) )
                    break
        
                // just in case it is a really old jpeg!
                case "jpeg":
                case TYPE_JPG:
                    promises.push( resizedStreamClone.jpeg(options).toFile(destination) )
                    break

                case TYPE_PNG:
                    promises.push( resizedStreamClone.png(options).toFile(destination) )
                    break
            }

            //console.log(">", type, filename, promises[promises.length-1] )
        }  

    }
    console.log( `Ready to encode`.green + ` `.green + ` ${sizes.length} sizes `.green.inverse  +  ` into `.green + ` ${types.join(' & ')} `.green.inverse + ` types, resulting in `.green + ` ${promises.length} images `.green.inverse )

    // Create a pipeline that will download an image, resize it and format it to different files
    // Using Promises to know when the pipeline is complete
    return Promise.all(promises)
        .then(res => { 
            // combine the outputs with the filenames
            const results = res.map( (result, index) => {
                return {
                    ...metadata,
                    ...result,
                    name:filenames[index],
                    file:file
                }
            })
            
            return results
        })
        .catch(err => {
            console.error("Error processing files, let's clean it up".magenta, err)
            try {

                for (let f in filenames)
                {
                    fs.unlinkSync(f)
                }
                
            } catch (e) {
                console.error("Error processing files".magenta, e )
            }
            throw err
        })
}

///////////////////////////////////////////////////////////////////////////
// Read all files from a folder and it's sub folders
///////////////////////////////////////////////////////////////////////////
async function readFolder(
    folder = './images', 
    subfolders = true,
    ALLOWED_TYPES = [".gif",".jpg",".png",".jpeg",".webp",".svg",".raw",".bmp", ".tiff"]
){
    const folderContents = await readdir(folder , {withFileTypes: true})
    const files = await Promise.all( folderContents.map( async (file) =>{

        const location = path.join(folder, file.name)
       
        if (file.isDirectory())
        {
            // this is a directory!
            //console.log( "dir", file, location  )
            return await readFolder( location, subfolders, ALLOWED_TYPES )
            
        }else if ( ALLOWED_TYPES.includes( path.extname(file.name).toLowerCase() ) ){

            // check the extension to see if it a type we can work with
            // check this file to see if it is an image that we can process...
            //console.log( "file", location )
            return location
        }

    } ) )

    // flatten and remove empty ones caused by drawers!
    return files.reduce((a, f) => a.concat(f), [])
}

///////////////////////////////////////////////////////////////////////////
// folder and options
///////////////////////////////////////////////////////////////////////////
const convertFolder = ( 

        folder,
        options = {
            sizes : [ {width:500}, {width:100} ],
            types : [ TYPE_WEBP, TYPE_JPG ],
            subfolders : true
        },
        callback = updates => console.log(updates.progress*100+'%')

    ) => {

    return readFolder( folder, options.subfolders ).then( images => {
    //return getFiles( folder ).then( images => {

        const outputs = []
        const output = []

        for (let i in images)
        {
            const filename = images[i]
            const type = path.extname(filename)
            
            console.log( i + 1, type, filename.green.underline)

            convertImage( filename, options.types, options.sizes ).then( result =>{

                // result
                outputs.push( result )

                const progress = outputs.length / images.length

                for (const r in result)
                {
                    output.push( result[r] )
                }

                console.log( `${Math.round(progress*100)}% ` + ` ${images.length} image(s) converted into ${result.length} format(s) `.inverse, filename )
                
                callback && callback({progress, filename, data:result})

                if (progress < 1)
                {
                    console.log( "In Progress", progress)
                }else{
                    console.log( `Converted ${output.length} image(s) from ${outputs.length} source(s) `.bold )
                    return output
                }
            })
        }    

    })
}



// TESTS! ///////////////////////////////////////////////////////////////////

// readFolder("./images", true).then(r=>console.log("ARGH!",r))

const f = './images-big/img_2048x1152_3x16bit_xxB_bars_45deg_bltr_0008.png'

// console.log(`${f}`.green); // outputs green text
// console.log('i like cake and pies'.underline.red) // outputs red underlined text
// console.log('inverse the color'.inverse); // inverses the color
// console.log('OMG Rainbows!'.rainbow); // rainbow

// convertImage(f).then( p=>{        
//     console.log( `${f} image(s) converted to`.green )
//     console.log( p )
// })


convertFolder( "./images" , {
    sizes : [ {width:500}, {width:100} ],
    types : [ TYPE_WEBP, TYPE_JPG, TYPE_PNG ]
}, ({progress, filename, data}) =>{

    console.log( `Finished! ${Math.round(progress*100)}% `.inverse + ` ${filename}` )
    return data
})

/*
// TODO: Just an easy way to use the output images...
const createIMG = (src, alt) => {
    
    return `<img src="${src}" alt="${alt}" >`
}

// TODO: 
const createPicture = (src, alt) => {
    return `<picture src="${src}" alt="${alt}" >`
}
*/

module.exports = {
    readFolder, 
    convertImage,
    convertFolder
}