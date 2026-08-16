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
            }
            this.removeItem(index);
            return true;
        }

        if (item.type === 'equipment' && item.effect && item.effect.toggleFlashlight) {
            player.toggleFlashlight();
            item.equipped = !item.equipped;
            return true;
        }

        return false;
    }

    getItems() { return [...this.items]; }
}
