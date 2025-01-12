import API from "../../api";
import CONSTANTS from "../../constants";
import { debug, i18n, warn } from "../../lib/lib";
import { canvasTokensGet, getCurrentToken } from "./utility";

export class TokenInfo {
	tokenId: string;
	token: Token;
	measureFrom: { x: number; y: number };
	location: { x: number; y: number };

	constructor(tokenId) {
		this.tokenId = tokenId;
		this.token = <Token>canvasTokensGet(this.tokenId);
		// this.measureFrom = undefined;
		// this.location = undefined;

		this.updateLocation(undefined);
		this.updateMeasureFrom(undefined);

		TokenInfo._tokenInfoMap.set(tokenId, this);
	}

	static _tokenInfoMap = new Map();

	static resetMap() {
		TokenInfo._tokenInfoMap = new Map();
	}

	updateLocation(updateData) {
		this.location = {
			x: updateData?.x ?? this.token.x,
			y: updateData?.y ?? this.token.y,
		};
	}

	updateMeasureFrom(updateData) {
		this.measureFrom = {
			x: updateData?.x ?? this.token.x,
			y: updateData?.y ?? this.token.y,
		};
	}

	static get current() {
		if (getCurrentToken() !== undefined) {
			return TokenInfo.getById(getCurrentToken()?.id);
		} else {
			return undefined;
		}
	}

	static getById(tokenId) {
		let ti = TokenInfo._tokenInfoMap.get(tokenId);
		if (!ti) {
			ti = new TokenInfo(tokenId);
			TokenInfo._tokenInfoMap.set(tokenId, ti);
		}
		return ti;
	}

	getFlag(flagName, dflt = undefined) {
		// Somehow unlinked tokens get their own copies of actors (they even share IDs) but which have their own flags
		const baseActor = <Actor>game.actors?.get(<string>this.token?.actor?.id);

		// Idea is being stupid - this isn't actually deprecated
		// noinspection JSDeprecatedSymbols
		return (
			this.token.document.getFlag(CONSTANTS.MODULE_NAME, flagName) ??
			baseActor.getFlag(CONSTANTS.MODULE_NAME, flagName) ??
			dflt
		);
	}

	get weaponRange() {
		return (
			<number>this.token.document.getFlag(CONSTANTS.MODULE_NAME, CONSTANTS.FLAG_NAMES.WEAPON_RANGE) ||
			CONSTANTS.DEFAULT_WEAPON_RANGE
		);
	}

	get speedOverride() {
		return this.token.document.getFlag(CONSTANTS.MODULE_NAME, CONSTANTS.FLAG_NAMES.SPEED_OVERRIDE);
	}

	get isIgnoreDifficultTerrain() {
		return this.token.document.getFlag(CONSTANTS.MODULE_NAME, CONSTANTS.FLAG_NAMES.IGNORE_DIFFICULT_TERRAIN);
	}

	async setFlag(flagName, newValue, updateActor) {
		debug("setFlag" + " " + flagName + " " + newValue + " " + updateActor);

		// Somehow unlinked tokens get their own copies of actors (they even share IDs) but which have their own flags
		const baseActor = <Actor>game.actors?.get(<string>this.token?.actor?.id);

		// Idea is being stupid - it's looking up the deprecated versions of the methods
		if (updateActor) {
			// noinspection JSDeprecatedSymbols
			await this.token.document.unsetFlag(CONSTANTS.MODULE_NAME, flagName);
			// noinspection JSDeprecatedSymbols
			await baseActor.setFlag(CONSTANTS.MODULE_NAME, flagName, newValue);
		} else {
			// noinspection JSDeprecatedSymbols
			await this.token.document.setFlag(CONSTANTS.MODULE_NAME, flagName, newValue);
		}
	}

	async setWeaponRange(range, updateActor = false) {
		await this.token.document.setFlag(CONSTANTS.MODULE_NAME, CONSTANTS.FLAG_NAMES.WEAPON_RANGE, updateActor);
	}

	async setSpeedOverride(speed, updateActor = false) {
		await this.token.document.setFlag(CONSTANTS.MODULE_NAME, CONSTANTS.FLAG_NAMES.SPEED_OVERRIDE, updateActor);
	}

	async setIgnoreDifficultTerrain(isIgnore, updateActor = false) {
		await this.token.document.setFlag(
			CONSTANTS.MODULE_NAME,
			CONSTANTS.FLAG_NAMES.IGNORE_DIFFICULT_TERRAIN,
			updateActor
		);
	}

	get speed() {
		const actor = this.token.actor;
		if (!actor) {
			throw "Tried to call getSpeed with an undefined actor";
		}

		const speedAttrPathSetting = <string>game.settings.get(CONSTANTS.MODULE_NAME, "speed-attr-path");

		if (this.speedOverride) {
			return this.speedOverride;
		} else if (speedAttrPathSetting) {
			// noinspection JSCheckFunctionSignatures,JSUnresolvedVariable
			//@ts-ignore
			return foundry.utils.getProperty(actor.system, speedAttrPathSetting);
		} else {
			return this.getSpeedFromAttributes();
		}
	}

	// TODO move
	getSpeedFromAttributes() {
		const actor = this.token.actor;
		//@ts-ignore
		const actorAttrs = actor?.system.attributes;

		let speed = 0;
		let otherSpeeds: number[] = [];
		if (game.system.id === "pf1" || game.system.id === "D35E") {
			otherSpeeds = Object.entries((otherSpeeds = actorAttrs.speed)).map((s: any) => s[1].total);
		} else if (game.system.id === "pf2e") {
			speed = actorAttrs.speed.total;
			// noinspection JSUnresolvedVariable
			otherSpeeds = actorAttrs.speed.otherSpeeds.map((s) => s.total);
		} else if (game.system.id === "dnd5e") {
			otherSpeeds = <number[]>Object.entries(actorAttrs.movement)
				.filter((s) => typeof s[1] === "number")
				.map((s) => s[1]);
		}

		otherSpeeds.forEach((otherSpeed) => {
			if (otherSpeed > speed) {
				speed = otherSpeed;
			}
		});

		debug("getSpeedFromAttributes()" + " " + game.system.id + " " + otherSpeeds + " " + speed);

		return speed;
	}
}

export function updateMeasureFrom(token, updateData) {
	const tokenId = token.id;
	const tokenInfo = TokenInfo.getById(tokenId);
	tokenInfo.updateMeasureFrom(updateData);
}

export function updateLocation(token, updateData) {
	const tokenId = token.id;
	const tokenInfo = TokenInfo.getById(tokenId);
	tokenInfo.updateLocation(updateData);
}

// // noinspection JSUnusedLocalSymbols
// Hooks.on("createCombatant", (combatant, options, someId) => {
//   const token = canvasTokensGet(combatant.token.id);
//   updateMeasureFrom(token, undefined);
//   API.combatRangeOverlay.instance.fullRefresh();
// });

// // noinspection JSUnusedLocalSymbols
// Hooks.on("deleteCombatant", (combatant, options, someId) => {
//   const token = canvasTokensGet(combatant.token.id);
//   updateMeasureFrom(token, undefined);
//   API.combatRangeOverlay.instance.fullRefresh();
// });

// // noinspection JSUnusedLocalSymbols
// Hooks.on("updateCombat", (combat, turnInfo, diff, someId) => {
//   if (combat?.previous?.tokenId) {
//     const token = canvasTokensGet(combat.previous.tokenId);
//     updateMeasureFrom(token, undefined);
//   }
//   API.combatRangeOverlay.instance.fullRefresh();
// });

// // noinspection JSUnusedLocalSymbols
// Hooks.on("updateToken", (tokenDocument, updateData, options, someId) => {
//   const tokenId = tokenDocument.id;
//   const realToken = <Token>canvasTokensGet(tokenId); // Get the real token
//   updateLocation(realToken, updateData);
//   if (!realToken.inCombat) {
//     updateMeasureFrom(realToken, updateData);
//   }
//   API.combatRangeOverlay.instance.fullRefresh();
// });

// Hooks.on("controlToken", (token, boolFlag) => {
//   if (boolFlag && TokenInfo.current.speed === 0 && TokenInfo.current.getSpeedFromAttributes() === 0) {
//     if (game.user?.isGM) {
//       warn(i18n(`${CONSTANTS.MODULE_NAME}.token-speed-warning-gm`),true);
//     } else {
//       warn(i18n(`${CONSTANTS.MODULE_NAME}.token-speed-warning-player`),true);
//     }
//   }
// })
