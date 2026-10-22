/** Browser-local prototype only: no account balance or server writes. */
export const WORLD_WIDTH = 2400;
export const SKILL_COOLDOWNS = [5, 8, 7, 9, 6, 12];
export class HuntEngine {
 x = 620; enemyX = 920; facing = 1; enemyHP = 100; hp = 100;
 elapsed = 0; kills = 0; coins = 0; xp = 0;
 auto = false; paused = false; action = 'stay1'; actionUntil = 0;
 cooldowns = [0, 0, 0, 0, 0, 0]; dodgeReady = 0; attackReady = 0; respawnAt = 0;
 lastDamage = 0; hitUntil = 0;
 step(dt: number, direction: number) {
  if (this.paused) return;
  dt = Math.max(0, Math.min(Number.isFinite(dt) ? dt : 0, .05));
  this.elapsed += dt;
  this.cooldowns = this.cooldowns.map(t => Math.max(0, t - dt));
  if (this.enemyHP <= 0 && this.elapsed >= this.respawnAt) {
   this.enemyHP = 100; this.enemyX = Math.min(WORLD_WIDTH - 90, Math.max(90, this.x + this.facing * 230));
  }
  if (this.auto && !direction && this.enemyHP > 0) {
   direction = Math.abs(this.enemyX - this.x) > 115 ? Math.sign(this.enemyX - this.x) : 0;
   if (!direction) this.attack();
  }
  if (this.elapsed >= this.actionUntil) {
   this.x = Math.max(65, Math.min(WORLD_WIDTH - 65, this.x + direction * 175 * dt));
   if (direction) this.facing = Math.sign(direction);
   this.action = direction ? 'run1' : 'stay1';
  }
 }
 attack(skill = -1) {
  if (this.paused || this.elapsed < this.actionUntil || this.elapsed < this.attackReady) return false;
  if (skill >= 0 && (skill >= 6 || this.cooldowns[skill] > 0)) return false;
  if (skill >= 0) this.cooldowns[skill] = SKILL_COOLDOWNS[skill];
  this.facing = Math.sign(this.enemyX - this.x) || this.facing;
  this.action = skill < 0 ? 'attack1' : ['skill1', 'skill2', 'skill3', 'skill4', 'skill5', 'rest1'][skill];
  this.actionUntil = this.elapsed + (skill === 4 ? .85 : .6); this.attackReady = this.elapsed + .65;
  if (skill === 5) this.hp = Math.min(100, this.hp + 25);
  else if (this.enemyHP > 0 && Math.abs(this.enemyX - this.x) < (skill >= 0 ? 330 : 155)) {
   const damage = skill >= 0 ? 40 : 20;
   this.lastDamage = Math.min(damage, this.enemyHP); this.hitUntil = this.elapsed + .75;
   this.enemyHP = Math.max(0, this.enemyHP - damage);
   if (!this.enemyHP) { this.kills++; this.coins += 25; this.xp += 12; this.respawnAt = this.elapsed + 2; }
  }
  return true;
 }
 dodge(direction: number) {
  if (this.paused || this.elapsed < this.dodgeReady || this.elapsed < this.actionUntil) return false;
  this.facing = direction < 0 ? -1 : 1;
  this.x = Math.max(65, Math.min(WORLD_WIDTH - 65, this.x + this.facing * 125));
  this.action = 'avoid1'; this.actionUntil = this.elapsed + .45; this.dodgeReady = this.elapsed + 1.2;
  return true;
 }
}
