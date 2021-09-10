// modifed from https://github.com/evomotors/SvgToGCode
// improved on by https://github.com/tatarize/SvgToGCode/blob/master/code/gcode.js

var fileName;
var svgImage;
var fileData;
var scaleMultiplier = 1;
var limit = 1.0
var interp = 10
var machineWidthInput = document.getElementById("hpgl-machine-width").value;
var machineHeightInput = document.getElementById("hpgl-machine-height").value;

 machineWidthInput = 793;
 machineHeightInput = 1122;

var HPGLColorCommands=[{Canvas:null, Color:"empty", Command:[{Move:"", X:0, Y:0, Z:0}]}];
var HPGLCommands=[];

ClearAll();

function readURL(input) {
    ClearAll();
    
    if (input.files && input.files[0]) {
        var reader = new FileReader();

        reader.onload = function (e) {
            fileData = e.target.result;
            svgImage = nsvgParse(fileData, 'px', 96);
            SetScaleMiltiplier();
            ParseSVG();
        };

        reader.readAsText(input.files[0]);
        fileName = input.files[0].name;
    }
}

function ParsePaths(paths, line, move) {
    for (var path = paths; path!=null; path = path.next){
        //Iterate through all the paths in the parsed svg file and access the points
        var x = rescale(path.pts[0]);
        var y = rescale(path.pts[1]);

        //Initial point
        move(x,y)
        for(var b = 2; b < path.pts.length; b += 6){
            // Iterate the Cubic Bezier curves outlined by the points.
            var p0x = rescale(path.pts[b-2]);
            var p0y = rescale(path.pts[b-1]);
            var p1x = rescale(path.pts[b])
            var p1y = rescale(path.pts[b+1])
            var p2x = rescale(path.pts[b+2])
            var p2y = rescale(path.pts[b+3])
            var x = rescale(path.pts[b+4])
            var y = rescale(path.pts[b+5])
            step = 1.0 / interp
            var xto = null
            var yto = null
            var t = 0
            for (var i = 0; i <= interp; i += 1) {
                // Between values of t for 0 and 1 calculate the point at t within the curve.
                t = step * i
                xt = (1-t)*(1-t)*(1-t)*p0x + 3*(1-t)*(1-t)*t*p1x + 3*(1-t)*t*t*p2x + t*t*t*x;
                yt = (1-t)*(1-t)*(1-t)*p0y + 3*(1-t)*(1-t)*t*p1y + 3*(1-t)*t*t*p2y + t*t*t*y;
                if ((Math.abs(xto - xt) < limit && Math.abs(yto - yt) < limit))
                     continue // too close to previous point, skip
                line(xt,yt)
                xto = xt
                yto = yt
            }
            //Place final value.
            line(x,y)
        }
    }
}

function ParseSVG(line, move){
    try
    {	
        // stroke color for combined color SVGs 
        var strokeColor = "rgb(1,1,1)";
        
        // create combined colors canvas and get it's context
        var mctx = GetCanvas(strokeColor).getContext("2d");

        for(var shape = svgImage.shapes; shape != null; shape=shape.next){
            if((strokeColor = GetStrokeColor(shape)) == null) continue

            var canv = GetCanvas(strokeColor);
            var ctx = canv.getContext("2d");

            HPGLCommands = GetColorCommands(strokeColor,canv);
            function move(x, y) {
               HPGLCommands.push({Move:"PU", X:x, Y:y});
               ctx.moveTo(x, y);
               mctx.moveTo(x, y);
            }
            function line(x,y) {
                HPGLCommands.push({Move:"PD", X:x, Y:y});
                ctx.lineTo(x, y);
                mctx.lineTo(x, y);
            }
            ParsePaths(shape.paths, line, move)
        }
        Finish(mctx);
    }
    catch(e){
        $(".alert-error").html('<strong>Error!</strong> ' + e.toString());
        $(".alert-error").css("display", "block");
    }
}	

function GetCanvas(color)
{
    var canvas = document.getElementById('cnv'+color);
    if(canvas==null){
        var div = document.createElement("p");
        div.style.width=machineWidthInput+'px';
        div.id='p'+color;
        div.style.backgroundColor=color;
        
        var cmd = document.createElement("button");
        cmd.id='cmd'+color;
        cmd.type='button';
        
        cmd.innerHTML='Download ' + (color=="rgb(1,1,1)"?'in one color.':color);
        cmd.style.width=machineWidthInput+'px';
        cmd.addEventListener('click', function() { SaveHPGL(this.id); }, false);
        
        canvas = document.createElement("canvas");
        canvas.id = 'cnv'+color;
        canvas.width=machineWidthInput;
        canvas.height=machineHeightInput;
        canvas.getContext("2d").strokeStyle = color;
        canvas.getContext("2d").beginPath();
        
        div.appendChild(canvas);
        div.appendChild(cmd);
        
        document.getElementById("canvases").appendChild(div);
    }
    return canvas;
}

function SetScaleMiltiplier()
{
    // Figure out the ratio
    var ratioX = machineWidthInput / svgImage.width;
    var ratioY = machineHeightInput / svgImage.height;
    
    // use whichever multiplier is smaller
    scaleMultiplier = ratioX < ratioY ? ratioX : ratioY;
}

function ClearAll()
{
    $(".alert").css("display", "none");
    $("#canvases").html("");
    HPGLCommands.length = 0;
    HPGLColorCommands.length = 0;
}

function Finish(mctx)
{
    // finish paint combined color canvas
    mctx.stroke();
    
    // finish paint individual color canvases
    for(HPGLColorCommand of HPGLColorCommands)
        if(HPGLColorCommand.Canvas != null)
            HPGLColorCommand.Canvas.getContext("2d").stroke();
    
    debugger;
    var numOfColors = $("canvas").length-1;
    var message = "Generated HPGL instructions for " + numOfColors.toString()  + 
        " color" + (numOfColors>1?"(s)":"");
    
    // show success alert and hide error
    $(".alert-success").html('<strong>Success!</strong> ' + message);
    $(".alert-success").css("display", "block");
    
    // remove second canvas if there is only one color
    if($("p").length == 2)
        $("p:last").remove();
    
    // force cursor 
    $(document).css('cursor', 'pointer');
    
    return;
}

function GetStrokeColor(shape)
{
    if(shape.stroke.color == 0 && shape.stroke.fillcolor == null && shape.fill.color == null)
        return null;
    else if(shape.stroke.color == 0 && shape.stroke.fillcolor != null)
        return shape.stroke.fillcolor;
    else if(shape.stroke.color == 0 && shape.fill.color != null)
        return shape.fill.color;					
    else
        return shape.stroke.color;
}

function GetByKey(array, key, value){
    for (var i = 0; i < array.length; i++) {
        if (array[i][key] === value) {
            return array[i];
        }
    }
    return null;
}	

function GetColorCommands(strokeColor, canv)
{
    var HPGLCommands=[];
    var objCommands;
    
    if((objCommands = GetByKey(HPGLColorCommands, 'Color', strokeColor)) == null)
        HPGLColorCommands.push({Canvas:canv, Color:strokeColor, Command:HPGLCommands});
    else
        HPGLCommands = objCommands.Command;
    
    return HPGLCommands;
}

function rescale(x){
    return x * scaleMultiplier;
}

function SaveHPGL(canvasId)
{
    $.confirm({
        boxWidth: '30%',
        useBootstrap: false,
        title: 'SVG to HPGL',
        content: '<font color="'+GetHexFromRGB(canvasId.substring(3))+'">"Download HPGL for this color?"</font>',
        buttons: {
            cancel: function () {
                return;
            },
            somethingElse: {
                text: 'Yes please',
                btnClass: 'btn-blue',
                keys: ['enter', 'shift'],
                action: function(){
                    DownloadHPGL(canvasId);
                }
            }
        }
    });
}

function DownloadHPGL(canvasId) {
        
    var commands=['IN;SP1;'];

    debugger;
    
    if(canvasId.substring(3)=="rgb(1,1,1)"){
        for(HPGLColorCommand of HPGLColorCommands)
            for(var HPGLCommand of HPGLColorCommand.Command)
            commands.push(HPGLCommand.Move + (HPGLCommand.X * 10).toFixed(0) + "," + (HPGLCommand.Y * 10).toFixed(0) + ';' );
    }
    else
    {
        colorCommands = GetColorCommands(canvasId.substring(3))
        for(var HPGLCommand of colorCommands)
        commands.push(HPGLCommand.Move + (HPGLCommand.X * 10).toFixed(0) + "," + (HPGLCommand.Y * 10).toFixed(0) + ';' );
    }
    
    let a = document.createElement('a');
    a.style = 'display: none';
    document.body.appendChild(a);
    let url = window.URL.createObjectURL(new Blob(commands));
    a.href = url;
    a.download = fileName.split('.').slice(0, -1).join('.') + '.hpgl';
    a.click();
    window.URL.revokeObjectURL(url);
}

function GetHexFromRGB(color)
{
    var matchColors = /rgb\((\d{1,3}),(\d{1,3}),(\d{1,3})\)/;
    var match = matchColors.exec(color);
    
    debugger;
    
    if (match !== null) {
        var r = parseInt(match[1]).toString(16), g = parseInt(match[2]).toString(16), b = parseInt(match[3]).toString(16);
        return  "#" + (r == "0" ? "00" : r) + (g == "0" ? "00" : g) + (b == "0" ? "00" : b);
    }
}
