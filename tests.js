
// TESTS! ///////////////////////////////////////////////////////////////////

// readFolder("./images", true).then(r=>console.log("ARGH!",r))

// const f = './images-big/img_2048x1152_3x16bit_xxB_bars_45deg_bltr_0008.png'
const f = './images-big/img_2048x1152_3x16bit_xxB_rays_radial_center.png'

// console.log(`${f}`.green); // outputs green text
// console.log('i like cake and pies'.underline.red) // outputs red underlined text
// console.log('inverse the color'.inverse); // inverses the color
// console.log('OMG Rainbows!'.rainbow); // rainbow

convertFolder( "./images" , {
    sizes : [ {width:500}, {width:100} ],
    types : [ TYPE_WEBP, TYPE_JPG, TYPE_PNG ]
}, ({progress, filename, data}) =>{

    console.log( `Finished! ${Math.round(progress*100)}% `.inverse + ` ${filename}` )
    return data
})


// Convert a single image file
convertImage(f).then( p=>{        
    console.log( `${f} image(s) converted to`.green )
    console.log( p )
})


// Should create a single IMG src pointing to a 100px width image
// with srsets for all scales of 100px up until the original size
createIMG(f, 100, "scale DPI tests", {importance:"auto", loading:"eager", decoding:"auto"} ).then(image => {
    
    console.log("Image created".green , image)
    // save the img to a html file for testing!
    fs.writeFile(`./${path.basename(f)}-img.html`, image, 'utf8', ()=>{
        console.log("Saved to disk!")
    })

}).catch(error => console.error( `${error}`.red.bold ) )


// Make a WebP picture with fallbacks
createPicture(f).then(picture => {

    // console.log(picture)
    const destination = `./${path.basename(f)}-picture.html`
    fs.writeFile(destination, picture, 'utf8', ()=>{
        console.log( `Saved ${destination} to disk!`.green )
        //console.log( picture )
    })

}).catch( error => console.error(`${error}`.red.bold ) )