/**
 * @author Pofu Lu
 * @email pofu.lu@outlook.com
 * @create date 2021-01-10 22:48:00
 * @modify date 2021-01-13 09:58:38
 * @desc v0.1.0
 */

const Scene = require('Scene');
const Blocks = require('Blocks');
const Patches = require('Patches');
const Reactive = require('Reactive');
const Time = require('Time');

export default (async () => {
    checkCapability();
    const blocks = await getBlockByStringProperty('identifier', '036a5d68-526a-11eb-ae93-0242ac130002');
    await Promise.all(blocks.map(setBlock));
})();

async function setBlock(block) {
    const [
        blockName,
        parentName,
        instantiate,
        clear,
        hide,
        prefix,
        inputs,
        outputs,    // TODO?: bridge the outputs value
        index,
        position,
        scale,
        rotation,
    ] = await Promise.all([
        block.outputs.getString('Block Name'),
        block.outputs.getString('Parent Name'),
        block.outputs.getPulseOrFallback('Instantiate', Reactive.once()),
        block.outputs.getPulseOrFallback('Clear', Reactive.once()),
        block.outputs.getPulseOrFallback('Hide', Reactive.once()),
        block.outputs.getString('Prefix'),
        block.outputs.getString('Inputs'),
        block.outputs.getString('Outputs'),
        block.outputs.getScalar('Control Index'),
        block.outputs.getPoint('Position'),
        block.outputs.getPoint('Scale'),
        block.outputs.getPoint('Rotation'),
    ]);

    let subscriptions = [];
    let children = [];
    let currentIndex = 0;
    let isInstantiating = true;
    let firstTime = true;

    const waitInstantiating = () => new Promise(resolve => {
        (function waitForFoo() {
            if (!isInstantiating) {
                return resolve();
            }

            Time.setTimeout(waitForFoo, 30);
        })();
    });

    const instantiatingFirst = async () => {
        await lateUpdateSignalAsync(Time.ms);

        if (isInstantiating) {
            await waitInstantiating();
        }
    }

    const onInstantiate = async instance => {
        const getTargetInstance = () => {
            const indexValue = index.pinLastValue();
            if (indexValue == -2) {
                return instance;
            } else if (indexValue == -1) {
                return children[currentIndex];
            } else {
                return children[indexValue];
            }
        }

        const eventSource = Reactive.monitorMany({
            x: position.x,
            y: position.y,
            z: position.z,
            scaleX: scale.x,
            scaleY: scale.y,
            scaleZ: scale.z,
            rotationX: rotation.x,
            rotationY: rotation.y,
            rotationZ: rotation.z,
        }, { fireOnInitialValue: true }).select('newValues');

        eventSource.subscribe(async values => {
            if (block.hidden.pinLastValue()) return;

            await instantiatingFirst();

            const blockInstance = getTargetInstance();

            if (blockInstance != undefined) {
                blockInstance.transform.x = values.x;
                blockInstance.transform.y = values.y;
                blockInstance.transform.z = values.z;
                blockInstance.transform.scaleX = values.scaleX;
                blockInstance.transform.scaleY = values.scaleY;
                blockInstance.transform.scaleZ = values.scaleZ;
                blockInstance.transform.rotationX = values.rotationX;
                blockInstance.transform.rotationY = values.rotationY;
                blockInstance.transform.rotationZ = values.rotationZ;
            }

        });

        await new Promise(resovle => eventSource.take(1).subscribe(() => {
            if (firstTime) {
                return lateUpdateSignalAsync(Time.ms).then(resovle);
            } else {
                resovle();
            }
        }));
    };

    const setInputs = async (instance, prefix, map) => {
        if (isEmptyOrSpaces(map)) {
            return;
        }

        map = map.split(':');
        const patchProperty = `${prefix}${map[0].replace(' ', '_')}`.trim();
        const blockProperty = map[0];
        const type = map[1].trim();

        const getTargetInstance = () => {
            const indexValue = index.pinLastValue();
            if (indexValue == -2) {
                return instance;
            } else if (indexValue == -1) {
                return children[currentIndex];
            } else {
                return children[indexValue];
            }
        }

        let setScalarSubscription;
        const setScalar = async () => {
            try {
                if (setScalarSubscription != undefined) {
                    setScalarSubscription.unsubscribe();
                    setScalarSubscription = undefined;
                }
                const signal = await Patches.outputs.getScalar(patchProperty);
                setScalarSubscription = signal.monitor({ fireOnInitialValue: true }).select('newValue').subscribe(async v => {
                    if (block.hidden.pinLastValue()) return;
                    await instantiatingFirst();

                    const blockInstance = getTargetInstance();
                    if (blockInstance != undefined) {
                        blockInstance.inputs.setScalar(blockProperty, v);
                    }
                });
                await lateUpdateSignalAsync(signal);
            } catch (error) { };
        };

        let setBooleanSubscription;
        const setBoolean = async () => {
            try {
                if (setBooleanSubscription != undefined) {
                    setBooleanSubscription.unsubscribe();
                    setBooleanSubscription = undefined;
                }
                const signal = await Patches.outputs.getBoolean(patchProperty);
                setBooleanSubscription = signal.monitor({ fireOnInitialValue: true }).select('newValue').subscribe(async v => {
                    if (block.hidden.pinLastValue()) return;
                    await instantiatingFirst();

                    const blockInstance = getTargetInstance();
                    if (blockInstance != undefined) {
                        blockInstance.inputs.setBoolean(blockProperty, v);
                    }
                });
                await lateUpdateSignalAsync(signal);
            } catch (error) { };
        };

        let setStringSubscription;
        const setString = async () => {
            try {
                if (setStringSubscription != undefined) {
                    setStringSubscription.unsubscribe();
                    setStringSubscription = undefined;
                }
                const signal = await Patches.outputs.getString(patchProperty);
                setStringSubscription = signal.monitor({ fireOnInitialValue: true }).select('newValue').subscribe(async v => {
                    if (block.hidden.pinLastValue()) return;
                    await instantiatingFirst();

                    const blockInstance = getTargetInstance();
                    if (blockInstance != undefined) {
                        blockInstance.inputs.setString(blockProperty, v);
                    }
                });
                await lateUpdateSignalAsync(signal);
            } catch (error) { };
        };

        let setColorSubscription;
        const setColor = async () => {
            try {
                if (setColorSubscription != undefined) {
                    setColorSubscription.unsubscribe();
                    setColorSubscription = undefined;
                }

                const signal = await Patches.outputs.getColor(patchProperty);
                const eventSource = Reactive.monitorMany({
                    x: signal.red,
                    y: signal.green,
                    z: signal.blue,
                    w: signal.alpha
                }, { fireOnInitialValue: true }).select('newValues');

                setColorSubscription = eventSource.subscribe(async values => {
                    if (block.hidden.pinLastValue()) return;
                    await instantiatingFirst();

                    const blockInstance = getTargetInstance();
                    if (blockInstance != undefined) {
                        blockInstance.inputs.setColor(blockProperty, Reactive.RGBA(values.x, values.y, values.z, values.w));
                    }
                })
                await new Promise(resovle => eventSource.take(1).subscribe(resovle));
            } catch (error) { };
        };

        let setVectorSubscription;
        const setVector = async () => {
            try {
                if (setVectorSubscription != undefined) {
                    setVectorSubscription.unsubscribe();
                    setVectorSubscription = undefined;
                }
                const signal = await Patches.outputs.getColor(patchProperty);
                const eventSource = Reactive.monitorMany({
                    x: signal.red,
                    y: signal.green,
                    z: signal.blue,
                    w: signal.alpha
                }, { fireOnInitialValue: true }).select('newValues');

                setVectorSubscription = eventSource.subscribe(async values => {
                    if (block.hidden.pinLastValue()) return;
                    await instantiatingFirst();

                    const blockInstance = getTargetInstance();
                    if (blockInstance != undefined) {
                        blockInstance.inputs.setColor(blockProperty, Reactive.RGBA(values.x, values.y, values.z, values.w));
                    }
                })
                await new Promise(resovle => eventSource.take(1).subscribe(resovle));
            } catch (error) { };
        };

        let setPointSubscription;
        const setPoint = async () => {
            try {
                if (setPointSubscription != undefined) {
                    setPointSubscription.unsubscribe();
                    setPointSubscription = undefined;
                }
                const signal = await Patches.outputs.getPoint(patchProperty);
                const eventSource = Reactive.monitorMany({
                    x: signal.x,
                    y: signal.y,
                    z: signal.z,
                }, { fireOnInitialValue: true }).select('newValues');

                setPointSubscription = eventSource.subscribe(async values => {
                    if (block.hidden.pinLastValue()) return;
                    await instantiatingFirst();

                    const blockInstance = getTargetInstance();
                    if (blockInstance != undefined) {
                        blockInstance.inputs.setPoint(blockProperty, Reactive.point(values.x, values.y, values.z));
                    }
                })
                await new Promise(resovle => eventSource.take(1).subscribe(resovle));
            } catch (error) { };
        };

        let setPoint2DSubscription;
        const setPoint2D = async () => {
            try {
                if (setPoint2DSubscription != undefined) {
                    setPoint2DSubscription.unsubscribe();
                    setPoint2DSubscription = undefined;
                }
                const signal = await Patches.outputs.getPoint2D(patchProperty);
                const eventSource = Reactive.monitorMany({
                    x: signal.x,
                    y: signal.y,
                }, { fireOnInitialValue: true }).select('newValues');

                setPoint2DSubscription = eventSource.subscribe(async values => {
                    if (block.hidden.pinLastValue()) return;
                    await instantiatingFirst();

                    const blockInstance = getTargetInstance();
                    if (blockInstance != undefined) {
                        blockInstance.inputs.setPoint2D(blockProperty, Reactive.point2d(values.x, values.y));
                    }
                });
                await new Promise(resovle => eventSource.take(1).subscribe(resovle));
            } catch (error) { };
        };

        let setPulseSubscription;
        const setPulse = async () => {
            try {
                if (setPulseSubscription != undefined) {
                    setPulseSubscription.unsubscribe();
                    setPulseSubscription = undefined;
                }
                const signal = await Patches.outputs.getPulse(patchProperty);
                setPulseSubscription = signal.subscribe(async () => {
                    if (block.hidden.pinLastValue()) return;
                    await instantiatingFirst();

                    const blockInstance = getTargetInstance();
                    if (blockInstance != undefined) {
                        getTargetInstance().inputs.setPulse(blockProperty, Reactive.once());
                    }
                });
            } catch (error) { };
        };

        switch (type.toLowerCase()) {
            case 'number': return setScalar();
            case 'scalar': return setScalar();
            case 'n': return setScalar();

            case 'bool': return setBoolean();
            case 'b': return setBoolean();
            case 'boolean': return setBoolean();

            case 'pulse': return setPulse();
            case 'p': return setPulse();

            case 'text': return setString();
            case 't': return setString();
            case 'string': return setString();

            case 'vector2': return setPoint2D();
            case 'vec2': return setPoint2D();
            case 'v2': return setPoint2D();
            case 'point2d': return setPoint2D();

            case 'vector3': return setPoint();
            case 'v3': return setPoint();
            case 'vec3': return setPoint();
            case 'point': return setPoint();

            case 'vector4': return setVector();
            case 'vec4': return setVector();
            case 'v4': return setVector();
            case 'vector': return setVector();

            case 'color': return setColor();
            case 'c': return setColor();

            default: break;
        }
    }

    const binding = async props => {
        if (subscriptions.length > 0) {
            subscriptions.forEach(sub => sub.unsubscribe());
            subscriptions = [];
        }

        if (props.disable) {
            return;
        }

        const parent = await Scene.root.findFirst(props.parentName);
        if (parent == undefined) {
            throw `The parent dosen't be found: "${props.parentName}" of "${block.name}".`;
        }

        const getInstance = async () => {
            let ins;

            const visibles = children.filter(child => child.hidden.pinLastValue() == true);

            if (visibles.length == 0) {
                try {
                    ins = await Blocks.instantiate(props.blockName, { name: `[${children.length}] ${props.blockName}` });
                    ins.hidden = true;

                    await lateUpdateSignalAsync(ins.hidden);
                    await parent.addChild(ins);

                    children.push(ins);
                } catch (error) {
                    throw `${error} "${props.blockName}" of "${block.name}".`;
                }
            } else {
                ins = visibles[0];
            }
            ins.hidden = true;
            return ins;
        }

        const instantiate_subscription = instantiate.subscribe(async () => {
            isInstantiating = true;
            const instance = await getInstance();
            currentIndex = children.indexOf(instance);
            isInstantiating = false;
            await Promise.all([
                onInstantiate(instance),
                (async () => {
                    const promises = props.inputs.split(',').map(i => setInputs(instance, props.prefix, i));
                    await Promise.all(promises);
                })(),
            ]);
            instance.hidden = false;
            firstTime = false;
        });

        const clear_subscription = clear.subscribe(async () => {
            const removePromises = children.map(child => parent.removeChild(child));
            await Promise.all(removePromises);
            children = [];
        });

        const hide_subscription = hide.subscribe(() => {
            children.forEach(child => child.hidden = true);
        });

        subscriptions.push(instantiate_subscription);
        subscriptions.push(clear_subscription);
        subscriptions.push(hide_subscription);
    };

    const signals = {
        disable: block.hidden,
        blockName: blockName,
        parentName: parentName,
        inputs: inputs,
        prefix: prefix,
    };

    monitorManyDiff(signals, { fireOnInitialValue: true }).subscribe(binding);
}

async function getBlockByStringProperty(propertyName, id) {
    const all = await Scene.root.findByPath('**/**');

    const blockFilter = async block => {
        if (block.outputs != undefined) {
            const identifier = await block.outputs.getStringOrFallback(propertyName, '')
            return identifier.eq(id).pinLastValue();
        } else {
            return false;
        }
    }

    const filterAsync = async (array, filter) => {
        const promises = array.map(filter);
        const map = await Promise.all(promises);
        return array.filter(() => map.shift());
    }

    return filterAsync(all, blockFilter);
}

function checkCapability() {
    if (Blocks == undefined) {
        throw 'Please enable "Scripting Dynamic Instantiation" in capabilites: \nProject > Edit Properties > Capabilities > "+" > Scripting Dynamic Instantiation';
    }
}

function invokeOnce(eventSource, callback) {
    return eventSource.take(1).subscribe(callback);
}

function invokeOnceAsync(eventSource, callback = () => { }) {
    return new Promise(resolve => {
        invokeOnce(eventSource, i => {
            callback(i);
            resolve(i);
        })
    })
}

function lateUpdateSignalAsync(signal, callback = () => { }) {
    return invokeOnceAsync(signal.monitor({ 'fireOnInitialValue': true }).select('newValue'), callback);
}

function invokeOnceOrList(eventSourceList, callback) {
    let events = [];
    eventSourceList.forEach(i => {
        events.push(i.subscribe(any => {
            callback(any);
            unsubscribeAll();
        }));
    })

    function unsubscribeAll() {
        events.forEach(e => {
            e.unsubscribe();
        });
    }

    return new class {
        unsubscribe() {
            unsubscribeAll();
        }
    }
}

function monitorManyDiff(signals, config) {
    const _signalPairs = [];

    for (var property in signals) {
        _signalPairs.push({
            name: property,
            value: signals[property]
        });
    }

    let _subscription;
    let _callback;

    function invoke(config) {
        let invoked = false;
        const fireOnInitialValue = config ? config.fireOnInitialValue : false;

        _subscription = invokeOnceOrList(_signalPairs.map(sig => sig.value.monitor({ fireOnInitialValue: fireOnInitialValue }).select('newValue')), () => {
            if (invoked) {
                return;
            }
            invoked = true;

            const result = {};
            for (let i = 0; i < _signalPairs.length; i++) {
                result[_signalPairs[i].name] = _signalPairs[i].value.pinLastValue();
            }

            _callback(result)
            invoke();
        })
    }

    return new class {
        subscribe(callback) {
            invoke(config);
            _callback = callback;

            return new class {
                unsubscribe() {
                    _subscription.unsubscribe();
                }
            }
        }
    }
}

function isEmptyOrSpaces(str) {
    return str === null || str.match(/^ *$/) !== null;
}

