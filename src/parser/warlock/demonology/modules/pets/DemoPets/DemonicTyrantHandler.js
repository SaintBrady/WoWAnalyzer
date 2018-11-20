import Analyzer, { SELECTED_PLAYER } from 'parser/core/Analyzer';
import Events from 'parser/core/Events';

import SPELLS from 'common/SPELLS';

import DemoPets from './index';
import { DESPAWN_REASONS, META_CLASSES, META_TOOLTIPS } from '../TimelinePet';
import PETS from '../PETS';

const test = false;

class DemonicTyrantHandler extends Analyzer {
  static dependencies = {
    demoPets: DemoPets,
  };

  _lastCast = null;
  _hasDemonicConsumption = false;
  _petsAffectedByDemonicTyrant = [];

  constructor(...args) {
    super(...args);
    this._initializeDemonicTyrantPets();
    this._hasDemonicConsumption = this.selectedCombatant.hasTalent(SPELLS.DEMONIC_CONSUMPTION_TALENT.id);
    this.addEventListener(Events.cast.by(SELECTED_PLAYER).spell(SPELLS.SUMMON_DEMONIC_TYRANT), this.onDemonicTyrantCast);
    this.addEventListener(Events.removebuff.to(SELECTED_PLAYER).spell(SPELLS.DEMONIC_POWER), this.onDemonicPowerRemove);
  }

  onDemonicTyrantCast(event) {
    // extend current pets (not random ones from ID/NP) by 15 seconds
    this._lastCast = event.timestamp;
    const affectedPets = this.demoPets.currentPets.filter(pet => this._petsAffectedByDemonicTyrant.includes(pet.id));
    test && this.log('Demonic Tyrant cast, affected pets: ', JSON.parse(JSON.stringify(affectedPets)));
    affectedPets.forEach(pet => {
      pet.extend();
      pet.pushHistory(event.timestamp, 'Extended with Demonic Tyrant', event);
      // if player has Demonic Consumption talent, kill all imps
      if (this._hasDemonicConsumption && this.demoPets.wildImpIds.includes(pet.id)) {
        test && this.log('Wild Imp killed because Demonic Consumption', pet);
        pet.despawn(event.timestamp, DESPAWN_REASONS.DEMONIC_CONSUMPTION);
        pet.setMeta(META_CLASSES.DESTROYED, META_TOOLTIPS.DEMONIC_CONSUMPTION);
        pet.pushHistory(event.timestamp, 'Killed by Demonic Consumption', event);
      }
    });
    test && this.log('Pets after Demonic Tyrant cast', JSON.parse(JSON.stringify(this.demoPets.currentPets)));
  }

  onDemonicPowerRemove(event) {
    // Demonic Tyrant effect faded, update imps' expected despawn
    const actualBuffTime = event.timestamp - this._lastCast;
    this.demoPets.currentPets
      .filter(pet => this.demoPets.wildImpIds.includes(pet.id))
      .forEach(imp => {
        // original duration = spawn + 15
        // extended duration on DT cast = (spawn + 15) + 15
        // real duration = (spawn + 15) + actualBuffTime
        const old = imp.expectedDespawn;
        imp.expectedDespawn = imp.spawn + PETS.WILD_IMP_HOG.duration + actualBuffTime;
        imp.pushHistory(event.timestamp, 'Updated expected despawn from', old, 'to', imp.expectedDespawn);
      });
  }

  _initializeDemonicTyrantPets() {
    const usedPetGuids = [
      PETS.DREADSTALKER.guid,
    ];
    if (this.selectedCombatant.hasTalent(SPELLS.SUMMON_VILEFIEND_TALENT.id)) {
      usedPetGuids.push(PETS.VILEFIEND.guid);
    }
    if (this.selectedCombatant.hasTalent(SPELLS.GRIMOIRE_FELGUARD_TALENT.id)) {
      usedPetGuids.push(PETS.GRIMOIRE_FELGUARD.guid);
    }

    this._petsAffectedByDemonicTyrant = [
      ...this.demoPets.wildImpIds,
      ...usedPetGuids.map(guid => this.demoPets._toId(guid)),
    ];
  }
}

export default DemonicTyrantHandler;
