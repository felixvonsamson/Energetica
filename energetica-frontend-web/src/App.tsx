import {useEffect, useState} from "react";
import {fetchNetworks, Network} from "./api/network";


function App () {
    const [
        networks,
        setNetworks
    ] = useState<Network[]>([]);

    useEffect(
        () => {
            fetchNetworks().
                then((fetchedNetworks) => {
                    console.log("c");
                    console.log(fetchNetworks);
                    setNetworks(fetchedNetworks.networks);
                }).
                catch((err: unknown) => {
                    console.error(err);
                });
        },
        []
    );

    return (
        <>
            <p>
                Hello world!
            </p>
            {
                networks.map((network) => <p key={network.id}>{network.name}</p>)
            }
        </>
    );
}

export default App;
