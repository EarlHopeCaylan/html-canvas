function SVGContainer(src) {
    this.src = src;
    this.image = null;
    var self = this;
    this.promise = XHR(src).then(function(svg) {
        return new Promise(function(resolve) {
            html2canvas.fabric.loadSVGFromString(svg, function (objects, options) {
                var canvas = new html2canvas.fabric.StaticCanvas('c');
                self.image = canvas.lowerCanvasEl;
                canvas
                    .setWidth(options.width)
                    .setHeight(options.height)
                    .add(html2canvas.fabric.util.groupSVGElements(objects, options))
                    .renderAll();
                resolve(canvas.lowerCanvasEl);
            });
        });
    });
}
