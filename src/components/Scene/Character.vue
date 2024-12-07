<script>
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader'

// 角色控制类
export class Character {
  constructor(scene, camera) {
    this.scene = scene
    this.camera = camera
    this.character = null
    this.moveSpeed = 0.1
    this.rotateSpeed = 0.05
    this.moveDirection = new THREE.Vector3()
    this.init()
  }

  async init() {
    // 临时使用一个简单的几何体代替角色模型
    const geometry = new THREE.CapsuleGeometry(0.5, 1, 4, 8)
    const material = new THREE.MeshStandardMaterial({ color: 0x00ff00 })
    this.character = new THREE.Mesh(geometry, material)
    this.character.position.y = 1
    this.character.castShadow = true
    this.scene.add(this.character)

    // 设置相机跟随
    this.camera.position.set(0, 3, 5)
    this.camera.lookAt(this.character.position)
  }

  update() {
    if (!this.character) return

    // 更新角色位置
    if (this.moveDirection.length() > 0) {
      this.moveDirection.normalize()
      this.character.position.add(this.moveDirection.multiplyScalar(this.moveSpeed))
    }

    // 更新相机位置
    const idealOffset = new THREE.Vector3(0, 3, 5)
    idealOffset.applyQuaternion(this.character.quaternion)
    idealOffset.add(this.character.position)
    this.camera.position.lerp(idealOffset, 0.1)
    this.camera.lookAt(this.character.position)
  }

  move(direction) {
    this.moveDirection.set(direction.x, 0, direction.z)
  }

  rotate(angle) {
    this.character.rotation.y += angle * this.rotateSpeed
  }
}
</script> 