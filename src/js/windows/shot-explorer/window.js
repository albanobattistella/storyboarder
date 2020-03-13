const ReactDOM = require('react-dom')
const React = require('react')
const { ipcRenderer, shell } = electron = require('electron')
const { Provider } = require('react-redux')
const log = require('electron-log')
log.catchErrors()
const { createStore, applyMiddleware, compose } = require('redux')
const thunkMiddleware = require('redux-thunk').default
const { reducer } = require('../../shared/reducers/shot-generator')
const presetsStorage = require('../../shared/store/presetsStorage')
const { initialState } = require('../../shared/reducers/shot-generator')

const poses = require('../../shared/reducers/shot-generator-presets/poses.json')
const ShotExplorer = require('../../shot-explorer').default
const service = require('../shot-generator/service')
const loadBoardFromData = require('../../shared/actions/load-board-from-data')
const {loadAsset, cleanUpCache} = require("../../shot-generator/hooks/use-assets-manager")
const ModelLoader = require("./../../services/model-loader")
const {getFilePathForImages} = require("./../../shot-generator/helpers/get-filepath-for-images")
const {
  setBoard,
  loadScene,
  resetScene,
} = require('../../shared/reducers/shot-generator')

let sendedAction = null
const actionSanitizer = action => (
    action.type === 'ATTACHMENTS_SUCCESS' && action.payload ?
    { ...action, payload: { ...action.payload, value: '<<DATA>>' } } : action
  )
  const stateSanitizer = state => state.attachments ? { ...state, attachments: '<<ATTACHMENTS>>' } : state
  const reduxDevtoolsExtensionOptions = {
    actionSanitizer,
    stateSanitizer,
    trace: true,
  }
  const composeEnhancers = (
      window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ &&
      window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__(reduxDevtoolsExtensionOptions)
    ) || compose
  const configureStore = function configureStore (preloadedState) {
    const store = createStore(
      reducer,
      preloadedState,
      composeEnhancers(
        applyMiddleware(
            thunkMiddleware, store => next => action => {
              if(action && sendedAction && action !== sendedAction) {
                ipcRenderer.send("shot-generator:updateStore", action)
              }
              next(action)
            })
      )
    )
    return store
  }


const store = configureStore({
  ...initialState,
  presets: {
    ...initialState.presets,
    scenes: {
      ...initialState.presets.scenes,
      ...presetsStorage.loadScenePresets().scenes
    },
    characters: {
      ...initialState.presets.characters,
      ...presetsStorage.loadCharacterPresets().characters
    },
    poses: {
      ...initialState.presets.poses,
      ...poses,
      ...presetsStorage.loadPosePresets().poses
    },
    handPoses: {
      ...initialState.presets.handPoses,
      ...presetsStorage.loadHandPosePresets().handPoses
    }
  },
})
ipcRenderer.on("shot-explorer:updateStore", (event, action) => {
  sendedAction = action
  store.dispatch(action)
})


const loadBoard = async (board, storyboarderFilePath) => {
  log.info(board)

  let shot = board.sg
  storedAction = setBoard(board)
  store.dispatch(storedAction)
  
  if (shot) {
    storedAction = loadScene(shot.data)
    store.dispatch(storedAction)
  } else {
    storedAction = resetScene()
    store.dispatch(storedAction)
  }
  
  
  if (!board.sg) {
    return false
  }

  //const { storyboarderFilePath } = await service.getStoryboarderFileData()
  const {sceneObjects, world} = board.sg.data

  await Object.values(sceneObjects)
  // has a value for model
  .filter(o => o.model != null)
  // is not a box
  .filter(o => !(o.type === 'object' && o.model === 'box'))
  // what's the filepath?
  .map((object) => ModelLoader.getFilepathForModel(object, { storyboarderFilePath }))
  // request the file
  .map(loadAsset)

  if (world.environment.file) {
    await loadAsset(
      ModelLoader.getFilepathForModel({
        model: world.environment.file,
        type: 'environment'
      }, { storyboarderFilePath })
    )
  }

  const paths = Object.values(sceneObjects)
  .filter(o => o.volumeImageAttachmentIds && o.volumeImageAttachmentIds.length > 0)
  .map((object) => getFilePathForImages(object, storyboarderFilePath))

  for(let i = 0; i < paths.length; i++) {
    if(!Array.isArray(paths[i])) {
      await loadAsset(paths[i])
    } else {
      for(let j = 0; j < paths[i].length; j++) {
        await loadAsset(paths[i][j])
      }
    }
  }
}

ipcRenderer.on("shot-generator:open:shot-explorer", async (event) => {
  const { storyboarderFilePath, boardData } = await service.getStoryboarderFileData()
  const { board } = await service.getStoryboarderState()
  let aspectRatio = parseFloat(boardData.aspectRatio)
  sendedAction = {
    type: 'SET_META_STORYBOARDER_FILE_PATH',
    payload: storyboarderFilePath
  }
  store.dispatch(sendedAction)
  sendedAction = {
    type: 'SET_ASPECT_RATIO',
    payload: aspectRatio
  }
  store.dispatch(sendedAction)

  await loadBoard(board, storyboarderFilePath)
})

ReactDOM.render(
  (store && <Provider store={ store }>
    <ShotExplorer store={ store }/>
  </Provider> ),
document.getElementById('main')
  )

