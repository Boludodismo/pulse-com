import {test} from 'node:test';
import assert from 'node:assert/strict';
import {chooseExisting, permissionReason} from './matching.ts';
test('shared family number does not merge distinct people',()=>assert.equal(chooseExisting({name:'Ana Cunha',phone:'31999851316'},[{id:1,name:'William Cunha',phone:'+5531999851316'}]).match,undefined));
test('corroborated name and phone match formatting variants',()=>assert.equal(chooseExisting({name:'Ana Cúnha',phone:'31999851316'},[{id:1,name:'ANA CUNHA',phone:'+5531999851316'}]).match?.id,1));
test('conflicting birthdays block a merge',()=>assert.equal(chooseExisting({name:'Ana Cunha',phone:'31999851316',birthDate:'1990-01-01'},[{id:1,name:'Ana Cunha',phone:'31999851316',birthDate:'1991-01-01'}]).ambiguous,true));
test('two existing copies cannot be silently selected',()=>assert.equal(chooseExisting({name:'Ana Cunha',phone:'31999851316'},[{id:1,name:'Ana Cunha',phone:'31999851316'},{id:2,name:'Ana Cunha',phone:'31999851316'}]).match,undefined));
test('archived legacy fragments are not reactivated',()=>assert.equal(chooseExisting({name:'Ana Cunha',phone:'31999851316'},[{id:1,name:'Ana Cunha',phone:'31999851316',isArchived:1}]).match,undefined));
test('administrative permission follows only supplied criteria',()=>{assert.equal(permissionReason({sources:[],tags:['.Nome_Confirmado']}),'admin_importacao_nome_confirmado');assert.equal(permissionReason({sources:[{kind:'anamnese'}],tags:[]}),'admin_importacao_anamnese');assert.equal(permissionReason({sources:[],tags:['IMPORTADO','Cliente em potencial']}),null)});
