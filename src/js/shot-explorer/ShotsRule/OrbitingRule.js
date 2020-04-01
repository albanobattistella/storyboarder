import ShotRule from "./ShotRule"
import getRandomNumber from "../utils/getRandomNumber"
import rotateAroundPoint from "../utils/rotateAroundPoint"

const getOrbitingAngle = () => {
    let sidePercentage = getRandomNumber(100)
    let frontAndBackAngle = 110
    let sidesAngle = 70
    let angle 
    // Front side
    if(sidePercentage < 35) {
        angle = getRandomNumber(frontAndBackAngle) - frontAndBackAngle / 2
    } else if(sidePercentage >= 35 && sidePercentage < 60) {
        angle = -getRandomNumber(sidesAngle) - frontAndBackAngle / 2
    } else if(sidePercentage >= 60 && sidePercentage < 75) {
        angle = getRandomNumber(frontAndBackAngle) - frontAndBackAngle / 2
        angle = angle >= 0 ? 180 - angle : -(180 + angle)
    } else if(sidePercentage >= 75 && sidePercentage < 100) {
        angle = getRandomNumber(sidesAngle) + frontAndBackAngle / 2
    }
    return angle
}

class OrbitingRule extends ShotRule {
    constructor(focusedCenter, camera) {
        super(focusedCenter, camera);
        this.angle = getOrbitingAngle() * THREE.Math.DEG2RAD;
    }

    applyRule() {
        super.applyRule();
        let object = new THREE.Object3D()
        object.add(this.camera)
        rotateAroundPoint(this.camera.parent, this.focusedCenter, new THREE.Vector3(0, 1, 0), this.angle, false)
        this.camera.parent.updateMatrixWorld(true)
        this.camera.applyMatrix(this.camera.parent.matrixWorld)
        this.camera.parent.remove(this.camera)
        this.camera.updateMatrixWorld(true)
    }
}

export default OrbitingRule;
