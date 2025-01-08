import {Starling} from "../src/index.js";

const starling = new Starling("ws://localhost:8080");

starling.events.use((event) => {
    console.log(event.data.debug);
});

starling.method('echo', context => {
    context.success({
        "success": true,
    });
});

starling.connect().then(() => {
    console.log('Connected');
    starling.sync().then(() => {
        console.log('Synced');
        console.log(starling.recoveryToken);
    }).catch(console.error);
});