import assert from "node:assert/strict";
import {
  allAddressesRecognizedIronwoodLocal,
  isIronwoodLocalCoordinate,
  recognizedIronwoodLocalAddress,
} from "../../../shared/localServiceArea";

assert.equal(recognizedIronwoodLocalAddress("Bessemer, MI"), true);
assert.equal(recognizedIronwoodLocalAddress("101 Main St, Bessemer, Michigan 49911"), true);
assert.equal(recognizedIronwoodLocalAddress("Ironwood MI"), true);
assert.equal(recognizedIronwoodLocalAddress("200 Example Rd, Ironwood, MI 49938"), true);
assert.equal(recognizedIronwoodLocalAddress("Ashland, WI 54806"), false);
assert.equal(allAddressesRecognizedIronwoodLocal(["Bessemer, MI", "Ironwood, MI"]), true);
assert.equal(allAddressesRecognizedIronwoodLocal(["Bessemer, MI", "Ashland, WI"]), false);
assert.equal(isIronwoodLocalCoordinate(-90.17, 46.45), true);
assert.equal(isIronwoodLocalCoordinate(-90.9, 46.45), false);

console.log("local service area tests passed");
