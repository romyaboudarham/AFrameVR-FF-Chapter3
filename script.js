let dot = document.getElementById('dot');
let countdown = document.getElementById('countdown');
let rig = document.getElementById('rig');
let camera = document.getElementById('camera');
let cursor = document.getElementById('cursor');
let arrow = document.getElementById('arrowID');
let stepCount = document.getElementById('step-count');
let ground = document.getElementById('groundID');
let underwater = document.getElementById('underwaterID');
let fishbowl = document.getElementById('fishbowlID');
let sky = document.getElementById('skyID');
let quietText = document.getElementById('quiet-text');
let stayText = document.getElementById('stay-text');
let endText = document.getElementById('end-text');
let endFader = document.getElementById('end-fader');
// let stars = document.getElementById('stars');
let restartChapter = false;

// footprints
let footprint1 = document.getElementById('footprint1');
let footprint2 = document.getElementById('footprint2');
let footprint3 = document.getElementById('footprint3');
let footprint4 = document.getElementById('footprint4');
let footprint5 = document.getElementById('footprint5');
let footprint6 = document.getElementById('footprint6');
let footprint7 = document.getElementById('footprint7');
let footprint8 = document.getElementById('footprint8');
let footprint9 = document.getElementById('footprint9');
let footprint10 = document.getElementById('footprint10');
let footprint11 = document.getElementById('footprint11');

// Set to false to start on the left foot: footprints swap sides and each foot
// is mirrored. The number mesh is left unmirrored so it still reads correctly.
const startRightFoot = true;

AFRAME.registerComponent('footprint', {
  schema: { number: { type: 'int' } },
  init: function () {
    if (startRightFoot) return;
    const el = this.el;
    el.object3D.position.x *= -1;
    el.addEventListener('model-loaded', () => {
      const model = el.getObject3D('mesh');
      const numberMesh = model.children.find((node) => node.name.startsWith('Text'));
      if (!numberMesh) return;

      // mirror everything except the number across the number's x position,
      // so the number keeps its place on the foot
      el.object3D.updateMatrixWorld(true);
      const center = new THREE.Box3().setFromObject(numberMesh).getCenter(new THREE.Vector3());
      const numberX = el.object3D.worldToLocal(center).x;
      const mirror = new THREE.Group();
      mirror.scale.x = -1;
      mirror.position.x = 2 * numberX;
      model.children.filter((node) => node !== numberMesh).forEach((node) => mirror.add(node));
      model.add(mirror);
    });
  }
});

AFRAME.registerComponent('button-start',{
  init: function () {
    this.el.addEventListener('abuttonup', this.start);
    this.el.addEventListener('bbuttonup', this.start);
    this.el.addEventListener('xbuttonup', this.start);
    this.el.addEventListener('ybuttonup', this.start);
  },
  start: function (evt) {
    fishbowlOutCountdown();
    subtitlesCountdown();
    endFadeOutCountdown();
    cursor.setAttribute('visible', 'false');
    arrow.setAttribute('visible', 'false');
    countdown.dispatchEvent(new CustomEvent('countdown-begin'))
    countdown.setAttribute('visible', 'true');
    disableDot();
  }
});

AFRAME.registerComponent("event-listener", {
    init: function() {
        this.el.addEventListener("click", function(e) {
          fishbowlOutCountdown();
          subtitlesCountdown();
          endFadeOutCountdown();
          cursor.setAttribute('visible', 'false');
          arrow.setAttribute('visible', 'false');
          countdown.dispatchEvent(new CustomEvent('countdown-begin'))
          countdown.setAttribute('visible', 'true');
          disableDot();
        });
    }
  });

function fishbowlOutCountdown() {
  setTimeout(() => {
    fishbowl.setAttribute('visible', 'false');
    // stars.setAttribute('visible', 'true');
  }, 20000);
}

function endFadeOutCountdown() {
  setTimeout(() => {
    endText.emit("animate");
  }, 48000); 
  setTimeout(() => {
    endFader.emit("animate");
  }, 51000);
}

function subtitlesCountdown() {
    // fade in
    setTimeout(() => {
      quietText.emit("animate");
    }, 23500);
    setTimeout(() => {
      stayText.emit("animate");
    }, 26000);
    // fade out
    setTimeout(() => {
      quietText.emit("animate_fadeOut");
      stayText.emit("animate_fadeOut");
    }, 30000);
}

AFRAME.registerComponent("countdown-animation-manager", {
    init: function() {
      // wait for the first animation to finish
      this.el.addEventListener("animationcomplete__first", e => {
        // start the second animation
        e.target.setAttribute('text-geometry', 'value', '2');
        this.el.emit("second")
      })
      this.el.addEventListener("animationcomplete__second", e => {
        // start the second animation
        e.target.setAttribute('text-geometry', 'value', '1');
        this.el.emit("third")
      })
      this.el.addEventListener("animationcomplete__third", e => {
        startScene();
      })
    }
  });

AFRAME.registerComponent('restart-chapter', {
  schema: {type: 'selector'},

  init: function () {
    var soundEl = this.el;

    soundEl.addEventListener('sound-ended', function () {
      restart();
    });
  }
});

rig.addEventListener("movingended", function(e) {
  if (!restartChapter) {
    AFRAME.utils.entity.setComponentProperty(this, "alongpath.curve", "#fall");
    AFRAME.utils.entity.setComponentProperty(this, "alongpath.dur", "4000");
  }
});

var curvepoints = document.querySelectorAll("#fall > a-curve-point");

  for (var i = 0; i < curvepoints.length; i++) {
      curvepoints[i].addEventListener("alongpath-trigger-activated", function(e){
        if (e.target != null) {
          switch(e.target.id) {
              // case "last":
              //   break;
              case "switch-light":
                ground.setAttribute('visible', 'false');
                // underwater.setAttribute('visible', 'true');
                fishbowl.setAttribute('visible', 'false');
                break;
          }
        }
      });
  }

function restart() {
  restartChapter = true;
  document.getElementById('countdown').setAttribute('text-geometry', 'value', '3');
  countdown.setAttribute('visible', 'false');
  cursor.setAttribute('visible', 'true');
  arrow.setAttribute('visible', 'true');
  pathLight.setAttribute('visible', 'true');
  ground.setAttribute('visible', 'true');
  endFader.setAttribute('material', 'opacity', '0.0');
  endText.setAttribute('material', 'opacity', '0.0');
  fishbowl.setAttribute('visible', 'true');
  // underwater.setAttribute('visible', 'false');
  // stars.setAttribute('visible', 'false');
  resetCamera();
  enableDot();
}

function startScene() {
  restartChapter = false;
  rig.setAttribute("alongpath", {
    curve: "#run",
    dur: 12400
  });
  var entity = document.querySelector('[sound]');
  entity.components.sound.playSound();
}

function disableDot() {
  dot.setAttribute('visible', 'false');
  dot.setAttribute('position', '0 100 17');
}

function enableDot() {
  dot.setAttribute('visible', 'true');
  dot.setAttribute('position', '0 6.1 14.5');
}

function resetCamera() {
  let controls = camera.components['look-controls'];
  controls.pitchObject.rotation.x = 0;
  controls.yawObject.rotation.y = 0;
  rig.setAttribute("alongpath", "curve", "#start");
}
