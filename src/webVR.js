import * as THREE from '../libs/three.module.js';
import { GLTFLoader } from '../libs/GLTFLoader.js';
import { FBXLoader } from '../libs/FBXLoader.js';
import { OBJLoader } from '../libs/OBJLoader.js';
import { VRButton } from '../libs/VRButton.js';
import { OrbitControls } from '../libs/OrbitControls.js';
import Stats from '../libs/stats.module.js';
import { GUI } from '../libs/dat.gui.module.js';

// create global variables for scene set up
let camera, scene, renderer, cameraControl, skyBox, sphereOfStars;

// create directional light so that shader has access to it
const dirLight = new THREE.DirectionalLight(0xffdeaa);
dirLight.position.set(15, 20, -70);

// create Groups to easily access several elements at the same time
const quadGroup = new THREE.Group();
const globeGroup = new THREE.Group();
const avatarGroup = new THREE.Group();
const radioGroup = new THREE.Group();

// create GUI so that all functions have access to it
const gui = new GUI();

// create clock for animation
const clock = new THREE.Clock();

// Global variables for animation
const animationsFolder = gui.addFolder('Animations');
var model1Ready = false;
var model2Ready = false;
let mixers = [];
let rotationY = 0.001;

// Global variables for sound
const listener = new THREE.AudioListener();
const sound = new THREE.Audio(listener);
const posSound = new THREE.PositionalAudio(listener);


// Create global variables for stats
const stats = Stats();
stats.showPanel(0);
document.body.appendChild(stats.dom);

// Create loading manager with loading screen
const loadingScreen = document.getElementById('loading-screen');
const loadingManager = new THREE.LoadingManager();
loadingManager.onStart = function () {
  console.log(`loading...`);
  document.getElementById('progress').innerHTML = '0 %';}
loadingManager.onProgress = function (url, itemsLoaded, itemsTotal) {
  console.log(`loaded ${url}, ${Math.round(itemsLoaded/itemsTotal*100,2)} % progress`);
  document.getElementById('progress').innerHTML = (`${Math.round(itemsLoaded/itemsTotal*100, 2)}%`);
}
loadingManager.onLoad = function () {
  console.log(`loading completed`);
  loadingScreen.classList.add( 'fade-out' );
  loadingScreen.innerHTML = "";
  loadingScreen.addEventListener( 'transitionend', onTransitionEnd);
}
loadingManager.onError = function (url) {console.log(`error: could not load ${url}`)}

function onTransitionEnd(e) {
	e.target.remove();
}


// Create Shader Properties
const starShaderProp = {
  uniforms: {
    starTexture: {
      value: new THREE.TextureLoader(loadingManager).load('../assets/star.png')
    }
  },
  vertexShader: document.getElementById('vs00').textContent,
  fragmentShader: document.getElementById('fs00').textContent,

  blending: THREE.AdditiveBlending,
  alphaTest: 0.3,
  transparent: true
};

const woodShaderProp = {
  uniforms: THREE.UniformsUtils.merge(
    [THREE.UniformsLib['lights'],
      {
        scale: {
          type: "f",
          value: 1.0
        },
        frequency: {
          type: "f",
          value: 15.3
        },
        noiseScale: {
          type: "f",
          value: 6.1
        },
        ringScale: {
          type: "f",
          value: 1.0
        },
        color1: {
          type: "c",
          value: new THREE.Color(0x49082a)
        },
        color2: {
          type: "c",
          value: new THREE.Color(0x540e26)
        },
        dirLightColor: {
          type: "v3",
          value: dirLight.color,
        },
        dirLightPosition: {
          type: "v3",
          value: dirLight.position,
        }
      }
    ]),
  lights: true,
  vertexShader: document.getElementById('vs01').textContent,
  fragmentShader: document.getElementById('fs01').textContent
};

let electricityShaderProp = {
  uniforms: {
    time: {
      type: 'f',
      value: 1.0
    }
  },
  transparent: true,
  depthTest: false,
  opacity: 0.0,
  side: THREE.DoubleSide,
  vertexShader: document.getElementById('vs02').textContent,
  fragmentShader: document.getElementById('fs02').textContent
};

// Initiaslisation function
function init() {
  setupRenderer();
  setupCameraAndScene();
  loadSkyBox();
  createLights();
  loadModels();
  createAmbientSound();
  createPositionSound();
  createUtils();
}

// set up camera, scene and orbit controls
function setupCameraAndScene() {
  camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 500);
  camera.position.set(100, 100, 120);
  scene = new THREE.Scene();
  camera.lookAt(scene.position);
  cameraControl = new OrbitControls(camera, renderer.domElement);
  // constrain orbit control to not go past the point cloud of stars
  cameraControl.maxDistance = 450.0;
}

// set up renderer, including shadowMap and xr
function setupRenderer() {
  renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true
  });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  //enable VR
  renderer.xr.setReferenceSpaceType('local');
  renderer.xr.enabled = true;
  renderer.xr.setFoveation(0.01);

  document.body.appendChild(VRButton.createButton(renderer));
  document.body.appendChild(renderer.domElement);

  // add event listener to allow resizing of the window
  window.addEventListener('resize', onWindowResize, false);
  console.log('loaded renderer');
}

// load skybox images as background of the scene
function loadSkyBox() {
  const loader = new THREE.CubeTextureLoader(loadingManager);
  skyBox = loader.load([
    '../assets/cubemap/px.png',
    '../assets/cubemap/nx.png',
    '../assets/cubemap/py.png',
    '../assets/cubemap/ny.png',
    '../assets/cubemap/pz.png',
    '../assets/cubemap/nz.png'
  ]);
  scene.background = skyBox;
  console.log('loaded skybox');
}

// create three different lights
function createLights() {
  const hemiLight = new THREE.HemisphereLight(0xffeeff, 0x4810b0, 0.6);
  scene.add(hemiLight);

  // already initialised so shader can use information
  dirLight.castShadow = true;
  dirLight.shadow.camera.top = 30;
  dirLight.shadow.camera.bottom = -40;
  dirLight.shadow.camera.left = -50;
  dirLight.shadow.camera.right = 50;
  dirLight.shadow.camera.near = 1.0;
  dirLight.shadow.camera.far = 100;
  scene.add(dirLight);

  // point light to brighten up shadow
  const pointLight = new THREE.PointLight(0xffeebb, 1.0, 50);
  pointLight.position.set(-15, 5, 0);
  //pointLight.castShadow = true; don't case shadows to enable faster rendering
  scene.add(pointLight);
  console.log('loaded lights');
}

// load quad model
function loadQuad() {
  const loader = new GLTFLoader(loadingManager);
  loader.load(
    '../assets/quad_lynn.gltf',
    function(gltf) {
      gltf.scene.traverse(function(child) {
        if (child instanceof THREE.Mesh) {
          child.receiveShadow = true;
          child.castShadow = true;
        }
      })
      gltf.scene.position.set(10, 0, 0);
      gltf.scene.scale.set(0.9, 0.9, 0.9);

      quadGroup.add(gltf.scene);
    }
  );
  console.log('loaded quad model');
}

// load grass for quad model
function loadGrass() {
  const textLoader = new THREE.TextureLoader(loadingManager);
  const colTexture = textLoader.load('../assets/whispy-grass-meadow-bl/wispy-grass-meadow_albedo.png');
  const normalTexture = textLoader.load('../assets/whispy-grass-meadow-bl/wispy-grass-meadow_normal-ogl.png');
  const heightTexture = textLoader.load('../assets/whispy-grass-meadow-bl/wispy-grass-meadow_height.png');
  const roughnessTexture = textLoader.load('../assets/whispy-grass-meadow-bl/wispy-grass-meadow_roughness.png');
  const metallicTexture = textLoader.load('../assets/whispy-grass-meadow-bl/wispy-grass-meadow_metallic.png');
  const aoTexture = textLoader.load('../assets/whispy-grass-meadow-bl/wispy-grass-meadow_ao.png');

  const material = new THREE.MeshStandardMaterial({
    map: colTexture
  });

  material.normalMap = normalTexture;
  material.roughnessMap = roughnessTexture;
  material.metallicMap = metallicTexture;
  material.displacementMap = heightTexture;
  material.displacementScale = 0.005;
  material.aoMap = aoTexture;
  material.aoMapIntensity = 1.0;

  var objLoader = new OBJLoader(loadingManager);
  objLoader.load('../assets/grass.obj', function(object) {
    object.traverse(function(child) {
      if (child instanceof THREE.Mesh) {
        child.material = material;
        child.receiveShadow = true;
        child.material.dispose();
        child.material = material;
        child.position.set(-6, 0, -14);
        child.scale.set(1.1, 1.1, 1.1);
      }
    })

    quadGroup.add(object);
    let positions = [0, 25];

    for (let i = 0; i < 3; i++) {
      var grass = object.clone();
      if (i < 2) {
        grass.position.x += positions[i];
        grass.position.z += positions[Math.abs(1 - i)];
      } else if (i == 2) {
        grass.position.x += positions[1];
        grass.position.z += positions[1];
      }
      quadGroup.add(grass);
    }
  });
  console.log('loaded grass patches');

}

// load wooden base for snow globe with shader material
function loadWoodenBase() {
  const woodShaderMat = new THREE.ShaderMaterial(woodShaderProp);

  const objLoader = new OBJLoader(loadingManager);
  objLoader.load('../assets/woodenBase.obj', function(object) {
    object.traverse(function(child) {
      if (child instanceof THREE.Mesh) {
        child.material = woodShaderMat;
        child.scale.set(2.5, 2.8, 2.5);
        child.position.set(0, -19, -5);
      }
    });
    scene.add(object);
  });
  console.log('loaded wooden base');
}

// create glass sphere with that reflects skybox image
// and additional spheres with shader material
function createGlassSphere() {
  const geometry = new THREE.SphereGeometry(61, 128, 128);
  const material = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    transmission: 1,
    opacity: 0,
    metalness: 0,
    roughness: 0,
    ior: 2,
    thickness: 5,
    specularIntensity: 1,
    specularColor: 0xffeeff,
    envMap: skyBox,
    envMapIntensity: 1
  });
  let sphere = new THREE.Mesh(geometry, material);
  sphere.position.y = 35;
  globeGroup.add(sphere);

  const geometry2 = new THREE.SphereGeometry(1, 128, 128);
  var electricityShaderMat = new THREE.ShaderMaterial(electricityShaderProp);
  let sphere2 = new THREE.Mesh(geometry2, electricityShaderMat);
  sphere2.position.set(0, 29, -5);
  sphere2.scale.set(62, 62, 62);
  scene.add(sphere2);
  console.log('loaded glass spheres');
}

// create sandy ground within the snow globe
// ground for further models to stand on
function createGround() {
  const textLoader = new THREE.TextureLoader(loadingManager);
  const colTexture = textLoader.load('../assets/dusty-ground-gravel/dusty-ground-gravel1-albedo.png');
  const normalTexture = textLoader.load('../assets/dusty-ground-gravel/dusty-ground-gravel1-Normal-ogl.png');
  const heightTexture = textLoader.load('../assets/dusty-ground-gravel/dusty-ground-gravel1-Height.png');
  const roughnessTexture = textLoader.load('../assets/dusty-ground-gravel/dusty-ground-gravel1-Roughness.png');
  const metallicTexture = textLoader.load('../assets/dusty-ground-gravel/dusty-ground-gravel1-Metallic.png');
  const aoTexture = textLoader.load('../assets/dusty-ground-gravel/dusty-ground-gravel1-Ambient_Occlusion.png');

  const material = new THREE.MeshStandardMaterial({
    map: colTexture
  });
  material.map.repeat.set(16, 16);
  material.map.offset.set(4, 4);
  material.map.wrapS = THREE.RepeatWrapping;
  material.map.wrapT = THREE.RepeatWrapping;

  material.normalMap = normalTexture;
  material.roughnessMap = roughnessTexture;
  material.metallicMap = metallicTexture;
  material.displacementMap = heightTexture;
  material.displacementScale = 0.005;
  material.aoMap = aoTexture;
  material.aoMapIntensity = 0.05;

  let geometry = new THREE.CylinderGeometry(47, 42, 11, 64);

  let ground = new THREE.Mesh(geometry, material);
  ground.receiveShadow = true;
  globeGroup.add(ground);
  console.log('loaded ground');
}

// create billboard with video that suggests a lost signal
function createBillboard() {
  const geometry = new THREE.PlaneGeometry(5, 3.75);
  const video = document.getElementById('video');
  video.loop = true;
  //video.load();
  video.play();
  const texture = new THREE.VideoTexture(video);
  const material = new THREE.MeshStandardMaterial({
    map: texture
  });
  let billboard = new THREE.Mesh(geometry, material);
  billboard.position.set(-9.3, 8.5, -27.3);
  quadGroup.add(billboard);
  console.log('loaded billboard');
}

// create stars with points as buffer geometry with attributed vertex color
// and associated shader material
function createStars() {
  const sprite = new THREE.TextureLoader(loadingManager).load('../assets/star.png');

  const starColorOptions = [new THREE.Color(0xffeebb), new THREE.Color(0xffeeff), new THREE.Color(0xbbffff)];
  let starColorsArray = new Float32Array(10000 * 3);

  let stars = new THREE.BufferGeometry();
  let starsArray = [];

  var i = 0;

  while (starsArray.length < 10000) {
    let x = 2 * Math.random() - 1
    let y = 2 * Math.random() - 1
    let z = 2 * Math.random() - 1
    if (x * x + y * y + z * z < 1) {
      let star = new THREE.Vector3(400 * x, 400 * y, 400 * z);
      starsArray.push(star);
    }
    let randomIndex = Math.floor(Math.random() * 3);
    let color = starColorOptions[randomIndex];
    starColorsArray[3 * i] = color.r;
    starColorsArray[3 * i + 1] = color.g;
    starColorsArray[3 * i + 2] = color.b;

    i++;
  }
  stars.setFromPoints(starsArray);

  stars.setAttribute('color', new THREE.BufferAttribute(starColorsArray, 3));

  var starShaderMat = new THREE.ShaderMaterial(starShaderProp);
  sphereOfStars = new THREE.Points(stars, starShaderMat);
  scene.add(sphereOfStars);
  console.log('loaded stars');
}

// create first avatar with three associated animation actions added to GUI
function loadWoman() {
  const animationActions = [];
  let activeAction;
  let lastAction;
  let mixer;
  const fbxLoader = new FBXLoader(loadingManager);
  let modelFolder = animationsFolder.addFolder('Sitting Woman');
  modelFolder.open();

  fbxLoader.load(
    '../assets/woman/Sitting_Clap.fbx',
    (object) => {
      object.traverse(function(child) {
        if (child instanceof THREE.Mesh) {
          child.receiveShadow = true
          child.castShadow = true
        }
      });
      object.position.set(-14.6, 0, 0);
      object.rotation.y = 0.8;
      object.scale.set(0.02, 0.02, 0.02);
      mixer = new THREE.AnimationMixer(object);


      const animationAction = mixer.clipAction(object.animations[0]);
      animationActions.push(animationAction);
      modelFolder.add(animations, 'Sitting_Clap').name('Clap');

      avatarGroup.add(object);
      //add an animation from another file
      fbxLoader.load(
        '../assets/woman/Sitting_Yell.fbx',
        (object) => {

          const animationAction = mixer.clipAction(
            object.animations[0]
          );
          animationActions.push(animationAction);
          modelFolder.add(animations, 'Sitting_Yell').name('Yell');
          activeAction = animationActions[1];

          //add an animation from another file
          fbxLoader.load('../assets/woman/Fist_Pump.fbx', (object) => {
            const animationAction = mixer.clipAction(object.animations[0]);
            animationActions.push(animationAction);
            modelFolder.add(animations, 'Fist_Pump').name('Cheer');

            //modelReady = true;
            model1Ready = true;
            mixers.push(mixer);

            // Play active animation
            activeAction.play();
          });
        });


    });

  const animations = {
    Sitting_Clap: function() {
      setAction(animationActions[0]);
    },
    Sitting_Yell: function() {
      setAction(animationActions[1]);
    },
    Fist_Pump: function() {
      setAction(animationActions[2]);
    }
  }

  const setAction = toAction => {
    if (toAction != activeAction) {
      lastAction = activeAction;
      activeAction = toAction;
      //lastAction.stop()
      lastAction.fadeOut(1);
      activeAction.reset();
      activeAction.fadeIn(1);
      activeAction.play();
    }
  }
  console.log('loaded sitting woman');
}

// create second avatar with three associated animation actions added to GUI
function loadDancer() {
  const animationActions = [];
  let activeAction;
  let lastAction;
  let mixer;
  const fbxLoader = new FBXLoader(loadingManager);
  let modelFolder = animationsFolder.addFolder('Dancing Woman');
  modelFolder.open();

  fbxLoader.load(
    '../assets/dancingWoman/Shuffling.fbx',
    (object) => {
      object.traverse(function(child) {
        if (child instanceof THREE.Mesh) {
          child.receiveShadow = true
          child.castShadow = true
        }
      });
      object.position.set(-11.4, 0, 4.5);
      object.rotation.y = -2.5;
      object.scale.set(0.02, 0.02, 0.02);
      mixer = new THREE.AnimationMixer(object);

      const animationAction = mixer.clipAction(object.animations[0]);
      animationActions.push(animationAction);
      modelFolder.add(animations, 'Shuffling').name("Shuffle");

      avatarGroup.add(object);

      //add an animation from another file
      fbxLoader.load(
        '../assets/dancingWoman/Brooklyn_Uprock.fbx',
        (object) => {

          const animationAction = mixer.clipAction(
            object.animations[0]
          );
          animationActions.push(animationAction);
          modelFolder.add(animations, 'Brooklyn_Uprock').name('Brooklyn Uprock');
          activeAction = animationActions[1];

          //add an animation from another file
          fbxLoader.load('../assets/dancingWoman/Dancing_Twerk.fbx', (object) => {
            const animationAction = mixer.clipAction(object.animations[0]);
            animationActions.push(animationAction);
            modelFolder.add(animations, 'Dancing_Twerk').name('Twerk');

            model2Ready = true;
            mixers.push(mixer);
            activeAction.play();

          });
        });

    });

  const animations = {
    Shuffling: function() {
      setAction(animationActions[0]);
    },
    Brooklyn_Uprock: function() {
      setAction(animationActions[1]);
    },
    Dancing_Twerk: function() {
      setAction(animationActions[2]);
    }
  }

  const setAction = toAction => {
    if (toAction != activeAction) {
      lastAction = activeAction;
      activeAction = toAction;
      //lastAction.stop()
      lastAction.fadeOut(1);
      activeAction.reset();
      activeAction.fadeIn(1);
      activeAction.play();
    }
  }
  console.log('loaded dancing woman');
}

// create Radio that will be linked with positional audio
function loadRadio() {
  const textLoader = new THREE.TextureLoader(loadingManager);
  const colTexture = textLoader.load('../assets/radio/textures/radiobody_UNFOLD6_1001_BaseColor.png');
  const normalTexture = textLoader.load('../assets/radio/textures/radiobody_UNFOLD6_1001_Normal.png');
  const heightTexture = textLoader.load('../assets/radio/textures/radiobody_UNFOLD6_1001_Height.png');
  const roughnessTexture = textLoader.load('../assets/radio/textures/radiobody_UNFOLD6_1001_Roughness.png');
  const metallicTexture = textLoader.load('../assets/radio/textures/radiobody_UNFOLD6_1001_Metallic.png');

  const material = new THREE.MeshStandardMaterial({
    map: colTexture
  });

  material.map.minFilter = THREE.NearestFilter;
  material.map.magFilter = THREE.NearestFilter;

  material.normalMap = normalTexture;
  material.roughnessMap = roughnessTexture;
  material.metallicMap = metallicTexture;
  material.displacementMap = heightTexture;
  material.displacementScale = 0.005;

  const fbxLoader = new FBXLoader(loadingManager);
  fbxLoader.load('../assets/radio/realtoneradio_one.fbx', function(object) {
    object;
    object.traverse(function(child) {
      if (child instanceof THREE.Mesh) {
        child.receiveShadow = true;
        child.castShadow = true;
        child.material = material;
      }
    });
    object.scale.set(0.04, 0.04, 0.04);
    object.position.set(-17.5, 5.5, 0);
    radioGroup.add(object);
    globeGroup.add(radioGroup);
  });
  console.log('loaded radio');
}

// load benches
function loadBenches() {
  const gtlfLoader = new GLTFLoader(loadingManager);

  gtlfLoader.load(
    '../assets/bench.gltf',
    (gltf) => {
      let bench = gltf.scene;
      bench.traverse(function(child) {
        if (child instanceof THREE.Mesh) {
          //child.material = material;
          child.receiveShadow = true;
          child.castShadow = true;
        }
      });
      bench.position.set(-15, 0, 0.5);
      bench.rotation.y = 1.2;
      bench.scale.set(0.025, 0.025, 0.025);

      avatarGroup.add(bench);

      let bench1 = bench.clone();
      bench1.position.set(-20, 0, 11);
      bench1.rotation.y = 1.6;
      quadGroup.add(bench1);

      let bench2 = bench.clone();
      bench2.position.set(8.5, 0, -25);
      bench2.rotation.y = 0;
      quadGroup.add(bench2);

      let bench3 = bench2.clone();
      bench3.position.x = 30.5;
      quadGroup.add(bench3);
    });
    console.log('loaded benches');
}

// function to load and position all the models to then be called in init()
function loadModels() {

  loadQuad();
  loadGrass();
  createGround();
  quadGroup.scale.set(0.67, 0.67, 0.67);
  quadGroup.position.set(-8, 5.5, 9);
  createGlassSphere();
  loadWoodenBase();
  createBillboard();
  globeGroup.add(quadGroup);
  globeGroup.position.set(0, -9, -5);
  scene.add(globeGroup);
  loadWoman();
  loadBenches();
  loadDancer();
  quadGroup.add(avatarGroup);
  avatarGroup.rotation.y = 0.3;
  avatarGroup.position.set(-5, 0, -15.5);
  loadRadio();
  createStars();
  console.log('all models loaded');
}

// function to create ambient sound
function createAmbientSound() {
  const audioLoader = new THREE.AudioLoader(loadingManager);
  audioLoader.load('../assets/soft-ambient-background-music.mp3', function(buffer) {
    sound.setBuffer(buffer);
    sound.setLoop(true);
    sound.setVolume(0.01);
    sound.play();
  });
  console.log('loaded ambient sound');
}

// create positional sound and add it to radio group
function createPositionSound() {
  const audioLoader2 = new THREE.AudioLoader(loadingManager);
  audioLoader2.load('../assets/trendybeatz.mp3', function(buffer) {
    posSound.setBuffer(buffer)
    posSound.setRefDistance(10)
    posSound.setVolume(0.1)
  });
  radioGroup.add(posSound);
  console.log('loaded positional sound');
}

// add additional utility to the gui (sound and global rotation)
function createUtils() {
  const allAudioFolder = gui.addFolder("Audio");

  const muteObj = {
    stop: function() {
      listener.getMasterVolume() == 1 ? listener.setMasterVolume(0) : listener.setMasterVolume(1);
    }
  };
  allAudioFolder.add(muteObj, 'stop').name("Mute All");
  const muteAmbientObj = {
    stop: function() {
      sound.isPlaying ? sound.stop() : sound.play();
    }
  };
  allAudioFolder.add(muteAmbientObj, 'stop').name("Ambient Sound On/Off");


  const soundFolder = allAudioFolder.addFolder("Positional Audio");
  const mutePosObj = {
    stop: function() {
      posSound.isPlaying ? posSound.stop() : posSound.play();
    }
  };
  soundFolder.add(mutePosObj, 'stop').name("Radio On/Off");

  soundFolder.add(radioGroup.position, "x", -4, 4, .001).name("Pan");
  soundFolder.open();
  allAudioFolder.open();

  const animationFolder = animationsFolder.addFolder("Scene");

  const stopRotObj = {
    stop: function() {
      rotationY > 0 ? rotationY = 0.0 : rotationY = 0.001;
    }
  };
  animationFolder.add(stopRotObj, 'stop').name("Rotation On/Off");
  animationFolder.open();
  animationsFolder.open();
  console.log('loaded gui');
}

// function to resize window
function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

// animate function that calls itself every frame
function animate() {
  renderer.setAnimationLoop(animate);
  stats.begin();

  // advance animations
  let delta = clock.getDelta();
  if (model1Ready) mixers[0].update(delta);
  if (model2Ready) mixers[1].update(delta);
  electricityShaderProp.uniforms.time.value += delta;
  if (!renderer.xr.isPresenting) {
    globeGroup.rotation.y += rotationY;
    sphereOfStars.rotation.y -= rotationY;
  } else {
    sphereOfStars.rotation.y -= rotationY;
  }

  renderer.render(scene, camera);
  stats.end();
}

// calling init() and animate() to initialise and animate the scene
init();
animate();
