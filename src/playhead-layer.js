/**
 * @file
 *
 * Defines the {@link PlayheadLayer} class.
 *
 * @module playhead-layer
 */

define([
  'konva'
], function(Konva) {
  'use strict';

  /**
   * Creates a Konva.Layer that displays a playhead marker.
   *
   * @class
   * @alias PlayheadLayer
   *
   * @param {Object} options
   * @param {Player} options.player
   * @param {WaveformOverview|WaveformZoomView} options.view
   * @param {Boolean} options.showPlayheadTime If <code>true</code> The playback time position
   *   is shown next to the playhead.
   * @param {String} options.playheadColor
   * @param {String} options.playheadTextColor
   * @param {String} options.playheadFontFamily
   * @param {Number} options.playheadFontSize
   * @param {String} options.playheadFontStyle
   */

  function PlayheadLayer(options) {
    this._player = options.player;
    this._view = options.view;
    this._playheadPixel = 0;
    this._playheadLineAnimation = null;
    this._playheadVisible = false;
    this._playheadColor = options.playheadColor;
    this._playheadTextColor = options.playheadTextColor;

    this._playheadFontFamily = options.playheadFontFamily || 'sans-serif';
    this._playheadFontSize = options.playheadFontSize || 11;
    this._playheadFontStyle = options.playheadFontStyle || 'normal';

    this._playheadLayer = new Konva.Layer();

    this._createPlayhead(this._playheadColor);

    if (options.showPlayheadTime) {
      this._createPlayheadText(this._playheadTextColor);
    }

    this.fitToView();

    this.zoomLevelChanged();
  }

  /**
   * Adds the layer to the given {Konva.Stage}.
   *
   * @param {Konva.Stage} stage
   */

  PlayheadLayer.prototype.addToStage = function(stage) {
    stage.add(this._playheadLayer);
  };

  /**
   * Decides whether to use an animation to update the playhead position.
   *
   * If the zoom level is such that the number of pixels per second of audio is
   * low, we can use timeupdate events from the HTMLMediaElement to
   * set the playhead position. Otherwise, we use an animation to update the
   * playhead position more smoothly. The animation is CPU intensive, so we
   * avoid using it where possible.
   */

  PlayheadLayer.prototype.zoomLevelChanged = function() {
    var pixelsPerSecond = this._view.timeToPixels(1.0);
    var time;

    this._useAnimation = pixelsPerSecond >= 5;

    if (this._useAnimation) {
      if (this._player.isPlaying() && !this._playheadLineAnimation) {
        // Start the animation
        this._start();
      }
    }
    else {
      if (this._playheadLineAnimation) {
        // Stop the animation
        time = this._player.getCurrentTime();

        this.stop(time);
      }
    }
  };

  /**
   * Resizes the playhead UI objects to fit the available space in the
   * view.
   */

  PlayheadLayer.prototype.fitToView = function() {
    var height = this._view.getHeight();

    //console.log(this._playheadLine);
    //this._playheadLine.points([0.5, 0, 0.5, height]);
    // this._playheadLine.x(0);
    // this._playheadLine.y(0);

    if (this._playheadText) {
      this._playheadText.y(20);
    }
  };

  /**
   * Creates the playhead UI objects.
   *
   * @private
   * @param {String} color
   */

  PlayheadLayer.prototype._createPlayhead = function(color) {
    // Create with default points, the real values are set in fitToView().
    var playheadGroup = new Konva.Group({
      x: 0,
      y: 0,
      width: 10
    });
    var triangle = new Konva.RegularPolygon({
      x: 0,
      y: 0,
      sides: 3,
      radius: 10,
      fill: 'orange',
      stroke: 'orange',
      strokeWidth: 0,
      width: 10,
      height: 10
    });
    var playheadLine = new Konva.Line({
      stroke:      color,
      strokeWidth: 1
    });

    var customPlayHead = new Konva.Shape({
      stroke: color,
      strokeWidth: 2,
      fill: color,
      width: 26,
      x: 0,
      y: 0,
      height: 200,
      sceneFunc: function(context, shape) {
        context.beginPath();
        context.moveTo(13, 20);
        context.lineTo(0, 0);
        context.lineTo(26, 0);
        context.lineTo(13, 20);
        //context.lineTo(10, 5);
        context.lineTo(13, 200);
        //context.quadraticCurveTo(150, 100, 260, 170);
        context.closePath();
    
        // (!) Konva specific method, it is very important
        context.fillStrokeShape(shape);
      }
    });

    playheadGroup.add(playheadLine);
    playheadGroup.add(triangle);
    // this._playheadLine = new Konva.Arrow({
    //   stroke:      'orange',
    //   strokeWidth: 2,
    //   fill: 'orange',
    //   pointerLength: 10,
    //   pointerWidth: 10,
    //   x: 0,
    //   y: this._view.getHeight(),
    //   rotation: 180
    // });
    this._playheadLine = customPlayHead;
    this._playheadGroup = new Konva.Group({
      x: 0,
      y: 0
     // rotation: 180
    });

    this._playheadGroup.add(this._playheadLine);
    this._playheadLayer.add(this._playheadGroup);
  };

  PlayheadLayer.prototype._createPlayheadText = function(color) {
    var time = this._player.getCurrentTime();
    var text = this._view.formatTime(time);

    // Create with default y, the real value is set in fitToView().
    this._playheadText = new Konva.Text({
      x: 15,
      y: 0,
      text: text,
      fontSize: this._playheadFontSize,
      fontFamily: this._playheadFontFamily,
      fontStyle: this._playheadFontStyle,
      fill: color,
      align: 'right'
    });

    this._playheadGroup.add(this._playheadText);
  };

  /**
   * Updates the playhead position.
   *
   * @param {Number} time Current playhead position, in seconds.
   */

  PlayheadLayer.prototype.updatePlayheadTime = function(time) {
    this._syncPlayhead(time);

    if (this._player.isPlaying()) {
      this._start();
    }
  };

  /**
   * Updates the playhead position.
   *
   * @private
   * @param {Number} time Current playhead position, in seconds.
   */

  PlayheadLayer.prototype._syncPlayhead = function(time) {
    var pixelIndex = this._view.timeToPixels(time);

    var frameOffset = this._view.getFrameOffset();
    var width = this._view.getWidth();

    var isVisible = (pixelIndex >= frameOffset) &&
                    (pixelIndex <  frameOffset + width);

    this._playheadPixel = pixelIndex;

    if (isVisible) {
      var playheadX = this._playheadPixel - frameOffset;

      if (!this._playheadVisible) {
        this._playheadVisible = true;
        this._playheadGroup.show();
      }

      this._playheadGroup.setX(playheadX);

      if (this._playheadText) {
        var text = this._view.formatTime(time);
        var playheadTextWidth = this._playheadText.getTextWidth();

        this._playheadText.setText(text);

        if (playheadTextWidth + playheadX > width - 15) {
          this._playheadText.setX(-playheadTextWidth - 15);
        }
        else if (playheadTextWidth + playheadX < width) {
          this._playheadText.setX(15);
        }
      }

      this._playheadLayer.draw();
    }
    else {
      if (this._playheadVisible) {
        this._playheadVisible = false;
        this._playheadGroup.hide();

        this._playheadLayer.draw();
      }
    }
  };

  /**
   * Starts a playhead animation in sync with the media playback.
   *
   * @private
   */

  PlayheadLayer.prototype._start = function() {
    var self = this;

    if (self._playheadLineAnimation) {
      self._playheadLineAnimation.stop();
      self._playheadLineAnimation = null;
    }

    if (!self._useAnimation) {
      return;
    }

    var lastPlayheadPosition = null;

    self._playheadLineAnimation = new Konva.Animation(function() {
      var time = self._player.getCurrentTime();
      var playheadPosition = self._view.timeToPixels(time);

      if (playheadPosition !== lastPlayheadPosition) {
        self._syncPlayhead(time);
        lastPlayheadPosition = playheadPosition;
      }
    }, self._playheadLayer);

    self._playheadLineAnimation.start();
  };

  PlayheadLayer.prototype.stop = function(time) {
    if (this._playheadLineAnimation) {
      this._playheadLineAnimation.stop();
      this._playheadLineAnimation = null;
    }

    this._syncPlayhead(time);
  };

  /**
   * Returns the position of the playhead marker, in pixels relative to the
   * left hand side of the waveform view.
   *
   * @return {Number}
   */

  PlayheadLayer.prototype.getPlayheadOffset = function() {
    return this._playheadPixel - this._view.getFrameOffset();
  };

  PlayheadLayer.prototype.getPlayheadPixel = function() {
    return this._playheadPixel;
  };

  PlayheadLayer.prototype.showPlayheadTime = function(show) {
    var updated = false;

    if (show) {
      if (!this._playheadText) {
        // Create it
        this._createPlayheadText(this._playheadTextColor);
        this.fitToView();
        updated = true;
      }
    }
    else {
      if (this._playheadText) {
        this._playheadText.remove();
        this._playheadText.destroy();
        this._playheadText = null;
        updated = true;
      }
    }

    if (updated) {
      this._playheadLayer.draw();
    }
  };

  PlayheadLayer.prototype.updatePlayheadText = function() {
    // Update current play head
    if (this._playheadText) {
      var time = this._player.getCurrentTime();
      var text = this._view.formatTime(time);

      this._playheadText.setText(text);
    }

    this._playheadLayer.draw();
  };

  PlayheadLayer.prototype.destroy = function() {
    if (this._playheadLineAnimation) {
      this._playheadLineAnimation.stop();
      this._playheadLineAnimation = null;
    }
  };

  return PlayheadLayer;
});
