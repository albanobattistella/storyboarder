import React, { useRef, useMemo, useEffect, useState } from 'react'
import Electron, { ipcRenderer, remote } from 'electron'
const {dialog} = remote
import { connect } from 'react-redux'
import ItemList from './ItemList'
import fs, { readFileSync } from 'fs-extra'
import path from 'path'
import JSONEditor from './JsonEditor/JsonEditor';
import Modal from '../shot-generator/components/Modal'
import {settings} from '../services/language.config'
import { isBuiltInLanguage, builtInPath} from './helpers/isBuiltInLanguage'
const electronApp = Electron.app ? Electron.app : Electron.remote.app
const userDataPath = electronApp.getPath('userData')
const LanguagePreferences = React.memo(({storyboarderFilePath}) => {
    const [selectedJson, selectJson] = useState({})
    const [languages, setLanguages] = useState(settings.getSettingByKey('languages'))
    const [currentLanguage, setCurrentLanguage] = useState(settings.getSettingByKey('selectedLanguage'))
    const [isShowAddModal, showAddModal] = useState(false)
    const [isShowWarningModal, showWarningModal] = useState(false)
    const [isEditable, setEditable] = useState(!isBuiltInLanguage(currentLanguage))
    const generateLanguageName = useRef()
    const newLanguageName = useRef()
    const warningText = useRef()
    const getFilepath = () => {
        if(isBuiltInLanguage(currentLanguage)) {
            return path.join(builtInPath, `${currentLanguage}.json`)
        } else {
            return path.join(userDataPath, `locales/${currentLanguage}.json`)
        }
    }

    const getLanguageIndex = (language) => {
        let element = languages.filter((lng) => lng.fileName === language)[0]
        return languages.indexOf(element)
    }

    useEffect(() => {
        let data = readFileSync(getFilepath())
        let json = JSON.parse(data)

        json["Name"] = languages[getLanguageIndex(currentLanguage)].displayName

        selectJson(json)
    }, [currentLanguage])

    const onJsonChange = (value) => {
        let lng = languages[getLanguageIndex(currentLanguage)]

        if(lng.displayName !== value.Name) {
            languages[getLanguageIndex(currentLanguage)] = { fileName: currentLanguage, displayName: value.Name}
            settings.setSettingByKey('languages', languages)
            setLanguages(languages.slice())
        }
     
        let json = JSON.stringify(value)
        fs.writeFileSync(getFilepath(), json)
        ipcRenderer.send("languageModified", currentLanguage)
    }

    const generateNewLanguageName = () => {
        let isUniqueName = false
        let language = languages.find((lng) => lng.fileName === currentLanguage).displayName
        let newLng = language + " copy"
        let iteration = 1
        while(!isUniqueName) {
            if(!languages.some((lng) => lng.displayName === newLng)) {
                isUniqueName = true
            } else {
                newLng = language + ` copy${iteration}`
                iteration++
            }
        }
        newLanguageName.current = generateLanguageName.current = newLng
    }

    const addNewLanguage = (lng) => {
        const localesPath = path.join(userDataPath, 'locales')
        fs.ensureDirSync(localesPath)
        const filePath = path.join(localesPath, `${lng}.json`)
        let json = JSON.stringify(selectedJson)
        fs.writeFileSync(filePath, json)
        ipcRenderer.send("languageAdded", lng)
        setCurrentLanguage(lng)
        let languages = settings.getSettingByKey('languages')
        languages.push({ fileName:lng, displayName: lng })
        settings.setSettings({selectedLanguage: lng, languages})
        setLanguages([...languages])
    }

    const removeSelectedLanguage = () => {
        if(isBuiltInLanguage(currentLanguage)) {
            warningText.current = "You cannot remove built-in language"
        } else {
            warningText.current = `Are you sure you want to remove ${currentLanguage}`
        }
        showWarningModal(true)
    } 

    const proceedWithRemoval = () => {
        let languages = settings.getSettingByKey('languages')
        let newLanguage = languages[0]
        fs.removeSync(path.join(builtInPath, `${currentLanguage}.json`))
        ipcRenderer.send("languageRemoved", newLanguage.fileName)

        languages.splice(getLanguageIndex(currentLanguage), 1)
        settings.setSettings({selectedLanguage: newLanguage.fileName, languages})
        setLanguages([...languages])
        setCurrentLanguage(newLanguage.fileName)
    }

    const selectLanguage = (lng) => {
        if(isBuiltInLanguage(lng)) {
            setEditable(false)
        } else {
            setEditable(true)
        }
        settings.setSettings({selectedLanguage: lng})
        setCurrentLanguage(lng)
        ipcRenderer.send("languageChanged", lng)
    } 

    const exportLanguage = async () => {
        let filePath = await dialog.showOpenDialog({
            properties: ['openDirectory'],
            buttonLabel: 'Export'
        })
        if(filePath.canceled) return
        let json = JSON.stringify(selectedJson)
        let savePath = path.join(filePath.filePaths[0], selectedJson.Name + '.json')
        if(fs.existsSync(savePath)) {
            savePath = path.join(filePath.filePaths[0], selectedJson.Name + ' new.json')
        }
        fs.writeFileSync(savePath, json)
    }

    const importLanguage = async () => {
        let filePath = await dialog.showOpenDialog({
            properties: ['openFile'],
            filters: [
                { name: 'Json', extensions: ['json'] },
            ]
        })
        if(filePath.canceled) return
        let file = filePath.filePaths[0]
        let data = await fs.readFile(path.join(file))
        let json = JSON.parse(data)
        let displayName = json.Name
        if(!json.Name) {
            displayName = 'NewLanguage'
            json.Name = displayName
        }
        const localesPath = path.join(userDataPath, 'locales')
        fs.ensureDirSync(localesPath)
        let { name } = path.parse(file)
        const userDataFilePath = path.join(localesPath, `${name}.json`)
        let newJson = JSON.stringify(json)
        fs.writeFileSync(userDataFilePath, newJson)

        let languages = settings.getSettingByKey('languages')
        languages.push({ fileName:name, displayName: displayName })
        settings.setSettings({selectedLanguage: name, languages})
        setLanguages([...languages])
        ipcRenderer.send("languageAdded", name)
        setCurrentLanguage(name)
    }
    return (
        <div className="languages-container">
            {
                isShowWarningModal && 
                <Modal visible={ isShowWarningModal } onClose={() => showWarningModal(false)}>
                    <div style={{ margin: "5px 5px 5px 5px" }}>
                        {warningText.current}
                    </div>
                    {
                        isBuiltInLanguage(currentLanguage) ? 
                        <div className="modal-selector__div">
                            <button
                                className="modal-selector__button"
                                onClick={() => {
                                    showWarningModal(false)
                                }}>
                                    Proceed
                            </button>
                        </div>
                        :
                        <div className="modal-row">

                        <div className="modal-selector__div">
                            <button
                                className="modal-selector__button"
                                onClick={() => {
                                    showWarningModal(false)
                                }}>
                                    Cancel
                            </button>
                        </div>
                          <div className="modal-selector__div">
                          <button
                              className="modal-selector__button"
                              onClick={() => {
                                  showWarningModal(false)
                                  proceedWithRemoval()
                              }}>
                                  Continue
                          </button>
                            </div>
                        </div>
                    }
       
                </Modal>
            }
            {
                isShowAddModal && 
                <Modal visible={ isShowAddModal } onClose={() => showAddModal(false)}>
                    <div style={{ margin: "5px 5px 5px 5px" }}>
                        Set language label:
                    </div>
                    <div className="column" style={{ flex: 1 }}> 
                        <input 
                            className="modalInput"
                            type="text" 
                            placeholder={ generateLanguageName.current }
                            onChange={ (value) => newLanguageName.current = value.currentTarget.value }/>
                    </div>
                    <div className="modal-selector__div">
                        <button
                            className="modal-selector__button"
                            onClick={() => {
                                showAddModal(false)
                                addNewLanguage(newLanguageName.current)
                            }}>
                                Proceed
                        </button>
                    </div>
                </Modal>
            }
            <div className="languages-config">
                <h1 className="config-title">Language Editor</h1>
                <div id="config-intro" style={{paddingBottom: "20px"}}>Your friendly language editor. Add, Remove, Import or Export and share with others.</div>
                <ItemList 
                    languages={languages} 
                    onSelect={selectLanguage}
                    selectedLanguage={currentLanguage} />
                <div className="modify-buttons-container">
                    <div className="button" onClick={()=> { generateNewLanguageName(); showAddModal(true) }}>
                        +
                    </div>
                    <div className="button" onClick={() => { removeSelectedLanguage() }}>
                        -
                    </div>
                </div>

                <div id="button-content">
                    <div className="button-io " onClick={exportLanguage}>
                        Import
                    </div>
                    <div className="button-io " onClick={importLanguage}>
                        Export 
                    </div>
                </div>
            </div>
            <div className="language-editor">
                { !isEditable && 
                <div className="editor-warning">
                    <div className="editor-warning-text">
                        The default languages cannot be changed. You can copy default language and change it
                    </div>
                </div>  }
               <JSONEditor
                json={selectedJson}
                onChange={onJsonChange}
                />         
            </div>
        </div>
    )
})

export default connect(
    (state)=> ({
    storyboarderFilePath: state.storyboarderFilePath
    }), 
    {
    }
)(LanguagePreferences)