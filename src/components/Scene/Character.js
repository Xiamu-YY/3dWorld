import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader'

export class Character {
  constructor(scene, camera) {
    this.scene = scene
    this.camera = camera
    this.character = null
    this.moveSpeed = 0.1
    this.rotateSpeed = 0.1
    this.moveDirection = new THREE.Vector3()
    this.cameraOffset = new THREE.Vector3(0, 7, -10)
    
    // 动画相关属性
    this.mixer = null
    this.animations = {}
    this.currentAction = null
    this.isTransitioning = false
    
    // 调整物理属性
    this.velocity = new THREE.Vector3()
    this.gravity = -20
    this.jumpForce = 8
    this.isGrounded = true
    this.minHeight = 0
    this.fallMultiplier = 1.5
    
    // 添加碰撞相关属性
    this.collisionBox = null
    this.worldBounds = {
      minX: -50,
      maxX: 50,
      minZ: -50,
      maxZ: 50
    }
    this.buildings = []  // 存储场景中的建筑物
    
    this.terrain = null
    this.raycaster = new THREE.Raycaster()
    
    this.init()
  }

  async init() {
    const loader = new GLTFLoader()
    try {
      const gltf = await loader.loadAsync('/models/character/character.glb')
      this.character = gltf.scene
      
      // 打印动画列表
      console.log('可用的动画:', gltf.animations.map(anim => anim.name))
      
      // 基础设置
      this.character.scale.set(1, 1, 1)
      this.character.position.set(0, 0, 0)
      this.isGrounded = true
      
      // 设置阴影
      this.character.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true
          child.receiveShadow = true
        }
      })

      // 初始化动画系统
      if (gltf.animations && gltf.animations.length) {
        this.mixer = new THREE.AnimationMixer(this.character)
        
        // 保存所有动画
        gltf.animations.forEach(clip => {
          console.log('动画名称:', clip.name, '持续时间:', clip.duration)
          const action = this.mixer.clipAction(clip)
          this.animations[clip.name] = action
        })

        // 默认播放待机动画
        if (this.animations['idle']) {
          this.playAnimation('idle')
        }
      }

      // 创建角色的碰撞盒
      const box = new THREE.Box3().setFromObject(this.character)
      const size = box.getSize(new THREE.Vector3())
      this.collisionBox = new THREE.Box3(
        new THREE.Vector3(-size.x/4, 0, -size.z/4),
        new THREE.Vector3(size.x/4, size.y, size.z/4)
      )

      this.scene.add(this.character)
      this.updateCameraPosition()
      
    } catch (error) {
      console.error('模型加载失败:', error)
      // 备用几何体
      const geometry = new THREE.CapsuleGeometry(0.5, 1, 4, 8)
      const material = new THREE.MeshStandardMaterial({ color: 0x00ff00 })
      this.character = new THREE.Mesh(geometry, material)
      this.character.position.y = 0
      this.character.castShadow = true
      this.scene.add(this.character)
    }
  }

  update(deltaTime) {
    if (!this.character) return

    // 更新动画
    if (this.mixer) {
      this.mixer.update(deltaTime)
    }

    // 应用重力和更新位置
    if (!this.isGrounded) {
      // 下落时施加更大的重力
      const gravityMultiplier = this.velocity.y < 0 ? this.fallMultiplier : 1
      this.velocity.y += this.gravity * gravityMultiplier * deltaTime
      
      // 限制最大下落速度
      this.velocity.y = Math.max(this.velocity.y, -20)
      
      // 更新位置
      this.character.position.y += this.velocity.y * deltaTime
      
      // 检查是否落地
      if (this.character.position.y <= this.minHeight) {
        this.character.position.y = this.minHeight
        this.velocity.y = 0
        this.isGrounded = true
        
        // 落地时播放过渡动画
        if (this.moveDirection.length() > 0) {
          this.playAnimation('Walking', 0.1)
        } else {
          this.playAnimation('Idle', 0.1)
        }
      }
    }

    // 基础移动
    if (this.moveDirection.length() > 0) {
      // 理旋转
      if (Math.abs(this.moveDirection.x) > 0) {
        const rotationAmount = (Math.PI / 4) * this.rotateSpeed
        if (this.moveDirection.x > 0) {
          this.character.rotateY(rotationAmount)
        } else {
          this.character.rotateY(-rotationAmount)
        }
      }

      // 移动逻辑
      const moveVector = this.moveDirection.clone()
      moveVector.normalize().multiplyScalar(this.moveSpeed)
      
      const rotationMatrix = new THREE.Matrix4()
      rotationMatrix.makeRotationY(this.character.rotation.y)
      moveVector.applyMatrix4(rotationMatrix)
      
      // 检查碰撞后再移动
      if (this.checkCollisions(moveVector)) {
        this.character.position.add(moveVector)
        // 更新碰撞盒位置
        this.collisionBox.translate(moveVector)
      }

      // 更新动画
      if (!this.isGrounded) {
        this.playAnimation('Jump', 0.2)
      } else {
        this.playAnimation('Walking', 0.2)
      }
    } else {
      // 停止移动时的动画
      if (!this.isGrounded) {
        this.playAnimation('Jump', 0.2)
      } else {
        this.playAnimation('Idle', 0.2)
      }
    }

    this.updateCameraPosition()

    // 检查地形高度
    if (this.terrain && this.isGrounded) {
      const position = this.character.position.clone()
      this.raycaster.ray.origin.copy(position.add(new THREE.Vector3(0, 10, 0)))
      this.raycaster.ray.direction.set(0, -1, 0)
      
      const intersects = this.raycaster.intersectObject(this.terrain)
      if (intersects.length > 0) {
        const groundHeight = intersects[0].point.y
        this.minHeight = groundHeight // 更新最小高度为地形高度
        this.character.position.y = groundHeight
      }
    }
  }

  playAnimation(name, crossFadeTime = 0.2) {
    if (!this.animations[name] || this.isTransitioning) return
    
    const newAction = this.animations[name]
    
    if (this.currentAction === newAction) return
    
    if (this.currentAction) {
      // 设置过渡状态
      this.isTransitioning = true
      
      // 交叉淡入淡出到新动画
      newAction.reset()
      newAction.setEffectiveTimeScale(1)
      newAction.setEffectiveWeight(1)
      newAction.play()
      
      newAction.crossFadeFrom(this.currentAction, crossFadeTime, true)
      
      // 过渡结束后重置状态
      setTimeout(() => {
        this.isTransitioning = false
      }, crossFadeTime * 1000)
    } else {
      // 直接播放新动画
      newAction.play()
    }
    
    this.currentAction = newAction
  }

  updateCameraPosition() {
    const targetPosition = this.character.position.clone()
    const cameraOffset = this.cameraOffset.clone()
    targetPosition.add(cameraOffset)
    
    this.camera.position.copy(targetPosition)
    
    const lookAtPosition = this.character.position.clone()
    lookAtPosition.y += 2
    this.camera.lookAt(lookAtPosition)
  }

  move(direction) {
    this.moveDirection.set(direction.x, 0, direction.z)
  }

  jump() {
    if (this.isGrounded) {
      this.velocity.y = this.jumpForce
      this.isGrounded = false
      this.playAnimation('Jump', 0.1)
    }
  }

  // 添加建筑物到碰撞检测列表
  addBuilding(building) {
    this.buildings.push({
      object: building,
      box: new THREE.Box3().setFromObject(building)
    })
  }

  // 检查碰撞
  checkCollisions(moveVector) {
    if (!this.character || !this.collisionBox) return true

    // 创建预测位置的碰撞盒
    const predictedPosition = this.character.position.clone().add(moveVector)
    const predictedBox = this.collisionBox.clone().translate(predictedPosition)

    // 检查世界边界碰撞
    if (predictedPosition.x < this.worldBounds.minX || 
        predictedPosition.x > this.worldBounds.maxX || 
        predictedPosition.z < this.worldBounds.minZ || 
        predictedPosition.z > this.worldBounds.maxZ) {
      return false
    }

    // 检查与建筑物的碰撞
    for (const building of this.buildings) {
      if (predictedBox.intersectsBox(building.box)) {
        return false
      }
    }

    return true
  }

  setTerrain(terrain) {
    this.terrain = terrain
  }
} 