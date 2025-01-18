import {Starling} from "../src/index.js";

const starling = new Starling("ws://localhost:8080");

starling._events.use((event) => {
    const debug = event?.data?.debug;
    const error = event?.data?.error;
    
    if (error) {
        console.error(`[Starling:${error.type}]`, error);
    }
    if (debug) {
        // console.log(`[Starling:${debug.type}]`, debug.message);
    }
});

starling.on('**', (event) => {
    console.info('Notification:', event.data);
});

starling.method('super:echo', context => {
    console.log('Super echo request received');
    context.success({
        "success": true,
    });
});

starling.connect().then(() => {
    console.log('Connected');

    const request = starling.request('name:echo', {
        echo: 'Hello from echo'
    });

    request.onNotification(notification => {
        console.log('Echo notification', notification.data);
    }).then(response => {
        console.log('Echo response', response);
    });
    // starling.sync().then(() => {
    //     console.log('Synced');
    //     console.log(starling.recoveryToken);
    // }).catch(console.error);
});