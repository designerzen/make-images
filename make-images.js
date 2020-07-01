// Supported types to transcode to (svg is another but unuseful here)
const TYPE_JPG = "jpg"
const TYPE_WEBP = "webp"
const TYPE_PNG = "png"
const TYPE_GIF = "gif"

// Libs
const sharp = require("sharp")
const path = require('path')
const colors = require('colors')
const fs = require("fs")
const { readdir } = fs.promises

// just a console.log wrapper and saver
const log = () => {

}

// TODO: Add a way to override this method or proxy the args
const createFilename = (name,w,h,type, size=null) => {
    if (size)
    {
        return `${name}@${size}x.${type}`
    }else{
        const dimensions = w && h ? `${w}x${h}` : h && !w ? `${h}` : w
        return `${name}-${dimensions}.${type}`
    }
}

/*
WEB P
options Object ? output options
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
    background : { r: 255, g: 255, b: 255, alpha: 0 },
}

// Use null or undefined to auto-scale the height to match the width.
const defaultSize = {
    width:null,
    height:null
}

// This is the magic function
// Provide it with a single image file
// Choose which file types you want
// Pass in optional settings
const convertImage = async function(
        file, 
        types = [ TYPE_WEBP, TYPE_JPG ],
        sizes = [ {} ],
        settings = {} 
    ) {
        
    const options = Object.assign( {}, defaultOptions, settings )

    // work out original name without suffix or path
    // use path tool in case the file name is in the wrong format...
    file = path.normalize(file)

    const name = path.basename( file, path.extname(file) )
    const filePath = path.dirname(file)

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
 
    // if the "types" provided are as a single string rather than an array
    // assume the user meant a single type and create the array from it
    if (!types)
    {
        types = [metadata.format]
    }else if ( !Array.isArray(types) ){
        types = [types]
    }

    // TODO: LOOP
    //console.log("Converting", file, types, name)
    for (let d in sizes)
    {        
        const size = sizes[d]

        // if we have both dimensions, we do not need to do clever scaling
        const hasBothDimensions = size.hasOwnProperty("width") && size.hasOwnProperty("height")

        // If there are no dimensions supplied, simply do not resize
        //const dimensions = sizes[d]
        const dimensions = Object.assign( {}, defaultSize, size )
        // Use null or undefined to auto-scale the height to match the width.
        // || { width:metadata.width, height:metadata.height }
        
        // if there is a size in the dimensions always use the original dimension if not set...
        if (dimensions.hasOwnProperty("size") && !isNaN( parseFloat( dimensions.size ) ) )
        {
            // if neither are set use the originals...
            if (!dimensions.width && !dimensions.height)
            {
                // neither specified
                dimensions.width = metadata.width * dimensions.size
                dimensions.height = metadata.height * dimensions.size
           
            }else if (dimensions.width && dimensions.height){

                // if both the width and height are specified
                dimensions.width *= dimensions.size
                dimensions.height *= dimensions.size
        
            }else if (dimensions.width && !dimensions.height){
                
                // if the width is specified but not the height...
                // determine the height from the width and aspect ratio
                dimensions.width *= dimensions.size
                dimensions.height = dimensions.width / aspectRatio    
            
            }else if (!dimensions.width && dimensions.height){
                
                // if the width is specified but not the height...
                // determine the height from the width and aspect ratio
                dimensions.height *= dimensions.size
                dimensions.width = dimensions.height * aspectRatio   
            }

            // if a size is specified we use the new size otherwise we use the other size as reference
            dimensions.width = dimensions.width ? dimensions.width * dimensions.size : metadata.width * dimensions.size
            dimensions.height = dimensions.height ? dimensions.height * dimensions.size : metadata.height * dimensions.size
        }
        
        // console.error("dimensions",dimensions, 'hasBothDimensions',hasBothDimensions)
        const sharpOptions = {

            // set the dimensions
            width:Math.floor(dimensions.width),
            height:Math.floor(dimensions.height),
           
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

        // console.error("dims",sizes[d], dimensions, sharpOptions)
        
        // resize the stream.clone()
        const resizedStream = await sharpStream.resize(sharpOptions)
 
        // pause here until we have got the data
        // If we want to use something from the metadata we will have to wait...  
        const resizedMeta = await resizedStream.metadata()
        
        //console.log( "resizedStream : metadata", resizedMeta, "aspectRatio", aspectRatio, "dimensions", dimensions )
        
        // now loop through the types
        for ( let t in types )
        {
            const type = types[t].toLowerCase()
            const filename = createFilename( name, resizedMeta.width, resizedMeta.height, type, dimensions.size)
            const destination = path.join( options.destination, filePath, filename )
            const resizedStreamClone = resizedStream.clone()        
        
            // console.log("Destination", destination)
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

                case TYPE_GIF:
                    promises.push( resizedStreamClone.gif(options).toFile(destination) )
                    break
            }

            //console.log(">", type, filename, promises[promises.length-1] )
        }  

    }
    console.log( `Ready to encode`.green + ` `.green + ` ${sizes.length} sizes `.green.inverse  +  ` into `.green + ` ${types.length} type (${types.join(' & ')}) `.green.inverse + ` types, resulting in `.green + ` ${promises.length} new images `.green.inverse )

    // Create a pipeline that will download an image, resize it and format it to different files
    // Using Promises to know when the pipeline is complete
    return Promise.all(promises)
        .then(res => { 
            // combine the outputs with the filenames
            const results = res.map( (result, index) => {
                const folder = path.join( options.destination, filePath )
                return {
                    ...metadata,
                    ...result,
                    name:filenames[index],
                    folder:folder,
                    path:path.join( folder, filenames[index] ),
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
    ALLOWED_TYPES = [".gif",".jpg",".png",".apng",".jpeg",".webp",".svg",".raw",".bmp", ".tiff", ".ico"]
){
    const folderContents = await readdir(folder , {withFileTypes: true})
    const files = await Promise.all( folderContents.map( async (file) =>{

        const location = path.join(folder, file.name)
       
        if (file.isDirectory())
        {
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

// const createIMG = async function(src, width=100, alt="", settings={importance:"auto", loading:"eager", decoding:"auto"} ) {
   

// Indicates the relative download importance of the resource. Priority hints allow the values:
// auto: no preference. The browser may use its own heuristics to prioritize the image.
// high: the image is of high priority.
// low: the image is of low priority.

// loading : eager / lazy

// sizes :
// srcset :

// decoding : 
// sync - Decode the image synchronously, for atomic presentation with other content.
// async - Decode the image asynchronously, to reduce delay in presenting other content.
// auto - Default: no preference for the decoding mode. The browser decides what is best for the user.
// TODO: Just an easy way to use the output images...
const createIMG = async function(src, width=100, alt="", settings={importance:"auto", loading:"eager", decoding:"auto"} ) {

    const sharpStream = sharp( src, {} )
    
    // first fetch the size...
    const metadata = await sharpStream.metadata()
    const aspectRatio = metadata.width / metadata.height
    const format = metadata.format

    // check the requested size and see how many DPIs we can create...
    const originalWidth = metadata.width
    const scales = Math.floor( originalWidth / parseFloat(width) )
    const srcSets = []
    const sizes = []

    const limit = scales > 4 ? 4 : scales;

    for (let i=1; i<limit; ++i)
    {
        sizes.push({width:width, size:i})
    }

    console.log(`convertImage( ${f}, ${format}, 
                    ${JSON.stringify(sizes)}, 
                    ${JSON.stringify(settings)}
                )`)
    
    // take the source and create our resized versions
    return convertImage(f, format, sizes, settings).then( images =>{        
        // console.log( `${f} image(s) converted to`.green )
        // loop through images
        // or just skip straight to making the DPIs...
        // loop through scales and create our new sizes?
        images.forEach( (image,index) => {
            const dimensions = sizes[index]
            srcSets.push( `${image.path} ${dimensions.size}x` )
        })

        const srcset = srcSets.join(", ") // "two.png 2x, three.png 3x, four.png 4x"
        const height = Math.floor( width * aspectRatio )
                
        return (
`<img 
    src="${src}" 
    alt="${alt}"
    width="${width}"
    height="${height}"
    decoding="${settings.decoding}"
    importance="${settings.importance}"
    loading="${settings.loading}" 
    srcset="${srcset}"
>`)
    } ).catch( error => reject(error))
}



// This is a modifier that spits out attributes as an array
// but doesn't add the extra img tags
const createSourceAttributes = async function(src, width=100, format=TYPE_WEBP, options={} ) {
 
    const sharpStream = sharp( src, {} )
    
    // first fetch the size...
    const metadata = await sharpStream.metadata()
    const aspectRatio = metadata.width / metadata.height

    // check the requested size and see how many DPIs we can create...
    const originalWidth = metadata.width
    const scales = Math.floor( originalWidth / parseFloat(width) )
    const limit = scales > 4 ? 4 : scales;
    const srcSets = []
    const sizes = []
    
    for (let i=1; i<limit; ++i)
    {
        sizes.push({width:width, size:i})
    }
    
    // take the source and create our resized versions
    return convertImage(f, format, sizes, options).then( images =>{        
        // console.log( `${f} image(s) converted to`.green )
        // loop through images
        // or just skip straight to making the DPIs...
        // loop through scales and create our new sizes?
        images.forEach( (image,index) => {
            const dimensions = sizes[index]
            srcSets.push( `${image.path} ${dimensions.size}x` )
        })
        const srcset = srcSets.join(", ")
        return {
            src:src,
            width:width,
            height:Math.floor(width * aspectRatio),
            srcset:srcset,
            type:format
        }

    }).catch( error => {throw Error(error)} )
}



const createSource = (srcset, type) => {
    return `<source srcset="${srcset}" type="image/${type}">`
}


// TODO: 
// https://developer.mozilla.org/en-US/docs/Web/HTML/Element/picture
// Picture Element is a way to art direct an image depending on size.
// So the image may well entirely change depending on the screen size
// It is *not* for showing the same picture in different sizes
// HOWEVER, webP has only recently become cross browser so is still 
// considered a cutting edge feature and so to program a fallback without
// resorting to javascript you can use the source select inside <picture>
// For showing webP images you have to use the picture element
// and the sources tag to create fallbacks and overrides
const createPicture = async function( src, alt='', types=[TYPE_WEBP,TYPE_JPG] ){

    // first check the arguments are valid...
    if (!src) 
    {
        throw Error("No src provided")
        return
    }

    let width = 99999
    let height = 99999

    // get the dimensions of the original file...
    // convert to jpeg if not a gif or a png or webp?
    const sources = await Promise.all( types.map( async (type) => {
        // create an image with various types inside
        const sourceSet = await createSourceAttributes(src, 100, type)
        if (sourceSet.width < width) 
        {
            width = sourceSet.width
        }
        if (sourceSet.height < height) 
        {
            height = sourceSet.height
        }
        return createSource(sourceSet.srcset, sourceSet.type)
    }) )

    // console.log(sources)

    // create an image with various types inside
    const picture = 
    `<picture>
        ${sources.join('\n')}
        <img src="${path.normalize(src)}" alt="${alt}" width="${width}" height="${height}">
    </picture>`

    return picture
}

// Now an extra special feature!
// Provide this with an IMG element (or img string)
// and this method will convert it into a HiDPI src set
const createSrcSetForIMG = (img) => {
    // check to see if this is an IMGElement or a string
    // 
    if (typeof img === String)
    {

    }else{
        // convert the element to a string
    }
}


// one last handy method is using two or more terms of the url
// in order to set the requested dimensions.

// you could 
// for example use the name of the folder a file lives in as the widths


// Exports
module.exports = {
    readFolder, 
    convertImage,
    convertFolder,
    createIMG, createPicture
}