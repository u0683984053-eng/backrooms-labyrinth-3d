export class Inventory {
    constructor(maxSlots = 15) {
        this.maxSlots = maxSlots;
        this.items = [];
        this.selectedIndex = -1;

        this.addItem({
            id: 'almond_water', name: '杏仁水', icon: '💧', type: 'consumable',
            description: '恢复30点生命值。流浪者的生命之源。', stackable: true, count: 2,
            effect: { heal: 30 }
        });
        this.addItem({
            id: 'flashlight', name: '手电筒', icon: '🔦', type: 'equipment',
            description: '照亮黑暗，但会吸引实体注意。', equipped: false,
            effect: { toggleFlashlight: true }
        });
        this.addItem({
            id: 'ration', name: '口粮', icon: '🫓', type: 'consumable',
            description: '恢复15生命值和20体力值。', stackable: true, count: 3,
            effect: { heal: 15, stamina: 20 }
        });
        this.addItem({
            id: 'fire_salt', name: '火盐', icon: '🔥', type: 'weapon',
            description: '后室中少数能对抗实体的手段。朝视线方向投掷，灼烧实体。', stackable: true, count: 2,
            effect: { throwFireSalt: true }
        });
        this.addItem({
            id: 'memory_juice', name: '记忆汁', icon: '🧃', type: 'consumable',
            description: '恢复50点理智。M.E.G. 记载：紫色的汁液能抚平记忆的裂痕。', stackable: true, count: 1,
            effect: { sanity: 50 }
        });
        this.addItem({
            id: 'royal_ration', name: '皇家口粮', icon: '🍱', type: 'consumable',
            description: '恢复20生命值和40体力值。M.E.G. 后勤标准军用口粮。', stackable: true, count: 1,
            effect: { heal: 20, stamina: 40 }
        });
    }

    addItem(item) {
        if (item.stackable) {
            const ex = this.items.find(i => i.id === item.id);
            if (ex) { ex.count = (ex.count || 1) + (item.count || 1); return true; }
        }
        if (this.items.length >= this.maxSlots) return false;
        this.items.push({ ...item });
        return true;
    }

    removeItem(index) {
        if (index < 0 || index >= this.items.length) return null;
        const item = this.items[index];
        if (item.stackable && item.count > 1) { item.count--; return { ...item, count: 1 }; }
        this.items.splice(index, 1);
        if (this.selectedIndex === index) this.selectedIndex = -1;
        else if (this.selectedIndex > index) this.selectedIndex--;
        return item;
    }

    getItem(index) { return this.items[index] || null; }

    selectItem(index) {
        this.selectedIndex = (index >= 0 && index < this.items.length) ? index : -1;
        return this.items[this.selectedIndex] || null;
    }

    useItem(index, player) {
        const item = this.getItem(index);
        if (!item) return false;

        if (item.type === 'consumable') {
            if (item.effect) {
                if (item.effect.heal) player.heal(item.effect.heal);
                if (item.effect.stamina) player.stamina = Math.min(player.maxStamina, player.stamina + item.effect.stamina);
                if (item.effect.sanity) player.sanity = Math.min(100, player.sanity + item.effect.sanity);
                if (item.effect.sanityDrain) player.sanity = Math.max(0, player.sanity - item.effect.sanityDrain);
            }
            this.removeItem(index);
            return true;
        }

        if (item.type === 'equipment' && item.effect && item.effect.toggleFlashlight) {
            player.toggleFlashlight();
            item.equipped = !item.equipped;
            return true;
        }

        if (item.effect && item.effect.throwFireSalt) {
            this.removeItem(index);
            return { action: 'throwFireSalt' };
        }

        return false;
    }

    getItems() { return [...this.items]; }
}
