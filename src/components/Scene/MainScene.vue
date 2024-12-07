<template>
  <canvas ref="container" class="scene-container"></canvas>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import { Character } from './Character.js'

const container = ref(null)
let scene, camera, renderer, controls, character

// 添加场景尺寸状态
const sizes = {
  width: window.innerWidth,
  height: window.innerHeight
}

// 创建地面
const createGround = () => {
  // 增加地面大小和细分数
  const width = 200
  const height = 200
  const segments = 100 // 网格细分数
  
  const groundGeometry = new THREE.PlaneGeometry(width, height, segments, segments)
  
  // 创建高度变化
  const vertices = groundGeometry.attributes.position.array
  for (let i = 0; i < vertices.length; i += 3) {
    // 跳过边缘区域，保持平整
    const x = vertices[i]
    const z = vertices[i + 2]
    const distanceFromCenter = Math.sqrt(x * x + z * z)
    
    if (distanceFromCenter > 20) { // 中心20x20区域保持平整
      // 使用多个噪声函数叠加创建自然地形
      const height = 
        Math.sin(x * 0.1) * Math.sin(z * 0.1) * 2 +  // 大型起伏
        Math.sin(x * 0.3) * Math.sin(z * 0.3) * 0.5 + // 中型起伏
        Math.sin(x * 0.8) * Math.sin(z * 0.8) * 0.2   // 小型起伏
      vertices[i + 1] = height
    }
  }
  
  // 更新法线以确保正确的光照
  groundGeometry.computeVertexNormals()
  
  // 创建地面材质
  const groundMaterial = new THREE.MeshStandardMaterial({ 
    color: 0x808080,
    roughness: 0.8,
    metalness: 0.2,
    // 添加���凸贴图效果
    flatShading: true,
    // 添加顶点颜色变化
    vertexColors: true
  })
  
  // 添加顶点颜色
  const colors = []
  const positions = groundGeometry.attributes.position.array
  for (let i = 0; i < positions.length; i += 3) {
    const height = positions[i + 1]
    
    // 根据高度设置颜色
    if (height < 0) {
      // 低洼区域偏深色
      colors.push(0.3, 0.3, 0.3)
    } else if (height < 1) {
      // 平地区域正常颜色
      colors.push(0.5, 0.5, 0.5)
    } else {
      // 高地区域偏浅色
      colors.push(0.7, 0.7, 0.7)
    }
  }
  
  groundGeometry.setAttribute(
    'color',
    new THREE.Float32BufferAttribute(colors, 3)
  )
  
  const ground = new THREE.Mesh(groundGeometry, groundMaterial)
  ground.rotation.x = -Math.PI / 2
  ground.receiveShadow = true
  
  // 添加地面碰撞检测
  if (character) {
    character.setTerrain(ground)
  }
  
  scene.add(ground)
}

// 创建一些基础建筑
const createBuildings = () => {
  const buildingGroup = new THREE.Group()
  const buildings = [] // 临时存储建筑物
  
  // 创建建筑物
//   for (let i = 0; i < 20; i++) {
//     const width = Math.random() * 4 + 1
//     const height = Math.random() * 10 + 2
//     const depth = Math.random() * 4 + 1
    
//     const geometry = new THREE.BoxGeometry(width, height, depth)
//     const material = new THREE.MeshStandardMaterial({
//       color: Math.random() * 0xffffff,
//       roughness: 0.7,
//       metalness: 0.3
//     })
    
//     const building = new THREE.Mesh(geometry, material)
//     building.position.x = Math.random() * 80 - 40
//     building.position.z = Math.random() * 80 - 40
//     building.position.y = height / 2
//     building.castShadow = true
//     building.receiveShadow = true
    
//     buildingGroup.add(building)
//     buildings.push(building) // 保存建筑物引用
//   }
  
  scene.add(buildingGroup)
  return buildings // 返回建筑物数组
}

// 创建天空盒
const createSkybox = () => {
  // 创建加载管理器
  const loadingManager = new THREE.LoadingManager()
  loadingManager.onError = function(url) {
    console.error('加载出错:', url)
  }

  const loader = new THREE.CubeTextureLoader(loadingManager)
  loader.setPath('/textures/skybox/')
  
  const texture = loader.load([
    'px.png',
    'nx.png',
    'py.png',
    'ny.png',
    'pz.png',
    'nz.png'
  ], 
  // 成功回调
  () => {
    console.log('天空盒加载成功')
  },
  // 进度回调
  undefined,
  // 错误回调
  (err) => {
    console.error('天空盒加载失败:', err)
  })
  
  scene.background = texture
}

// 添加键盘控制
const keys = {
  KeyW: false,
  KeyS: false,
  KeyA: false,
  KeyD: false,
  Space: false  // 添加空格键
}

const handleKeyDown = (event) => {
  keys[event.code] = true
}

const handleKeyUp = (event) => {
  keys[event.code] = false
}

// 更新角色移动
const updateCharacterMovement = () => {
  if (!character) return

  const direction = new THREE.Vector3()

  if (keys.KeyW) direction.z += 1
  if (keys.KeyS) direction.z -= 1
  if (keys.KeyA) direction.x += 1
  if (keys.KeyD) direction.x -= 1

  character.move(direction)
  
  // 处理跳跃
  if (keys.Space) {
    character.jump()
  }
}

// 修改初始化场景函数
const initScene = () => {
  scene = new THREE.Scene()
  
  // 设置相机
  camera = new THREE.PerspectiveCamera(
    75,
    sizes.width / sizes.height,
    0.1,
    2000
  )

  // 设置渲染器
  renderer = new THREE.WebGLRenderer({
    canvas: container.value,
    antialias: true,
    alpha: true
  })
  renderer.setSize(sizes.width, sizes.height)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  
  // 设置相机位置
  camera.position.set(20, 20, 20)
  camera.lookAt(0, 0, 0)
  
  // 添加环境光
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.5)
  scene.add(ambientLight)
  
  // 添加平行光（太阳光）
  const directionalLight = new THREE.DirectionalLight(0xffffff, 1)
  directionalLight.position.set(50, 50, 0)
  directionalLight.castShadow = true
  directionalLight.shadow.mapSize.width = 2048
  directionalLight.shadow.mapSize.height = 2048
  directionalLight.shadow.camera.near = 1
  directionalLight.shadow.camera.far = 500
  directionalLight.shadow.camera.left = -50
  directionalLight.shadow.camera.right = 50
  directionalLight.shadow.camera.top = 50
  directionalLight.shadow.camera.bottom = -50
  scene.add(directionalLight)
  
  // 创建角色
  character = new Character(scene, camera)
  
  // 创建场景元素
  createGround()
  
  // 创建建筑物并添加碰撞
  const buildings = createBuildings()
  buildings.forEach(building => {
    character.addBuilding(building)
  })
  
  createSkybox()
  
  // 添加键盘事件监听
  window.addEventListener('keydown', handleKeyDown)
  window.addEventListener('keyup', handleKeyUp)
  
  animate()
}

// 修改动画循环
const clock = new THREE.Clock() // 添加时钟

const animate = () => {
  requestAnimationFrame(animate)
  const deltaTime = clock.getDelta() // 获取时间增量
  
  updateCharacterMovement()
  character?.update(deltaTime)
  renderer.render(scene, camera)
}

// 处理窗口大小变化
const handleResize = () => {
  // 更新尺寸
  sizes.width = window.innerWidth
  sizes.height = window.innerHeight

  // 更新相机
  camera.aspect = sizes.width / sizes.height
  camera.updateProjectionMatrix()

  // 更新渲染器
  renderer.setSize(sizes.width, sizes.height)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
}

onMounted(() => {
  initScene()
  window.addEventListener('resize', handleResize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
  window.removeEventListener('keydown', handleKeyDown)
  window.removeEventListener('keyup', handleKeyUp)
})
</script>

<style scoped>
.scene-container {
  position: fixed;
  top: 0;
  left: 0;
  outline: none;
  width: 100vw;
  height: 100vh;
}
</style> 