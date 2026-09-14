import test from "node:test";
import assert from "node:assert/strict";
import { clientPatchFromAnamnese, clientBirthDate, clientPersonalPrefill } from "../shared/clientPersonal.ts";

test("personal data maps to the existing client columns", () => {
  assert.deepEqual(clientPatchFromAnamnese({client_name:" Ana ", client_phone:"31999999999", client_dob:"02/08/2005", client_number:"75", client_complement:"Casa", client_cpf_rg:"RG 123"}),
    {name:"Ana",phone:"31999999999",birthDate:"2005-08-02 12:00:00",number:"75",complement:"Casa",docNumber:"RG 123"});
});
test("blank fields never erase existing personal data", () => {
  assert.deepEqual(clientPatchFromAnamnese({client_email:" ",client_phone:null,client_street:"",client_dob:""}), {});
});
test("payload cannot change identity, tenant, balances or health columns", () => {
  assert.deepEqual(clientPatchFromAnamnese({clientId:12,id:23,studioId:99,artistId:3,totalSpent:0,isArchived:1,health_diabetes:"sim",client_name:"Ana"}), {name:"Ana"});
});
test("invalid dates and non-string personal values are rejected", () => {
  assert.throws(() => clientBirthDate("31/02/2005"));
  assert.throws(() => clientBirthDate("01/01/2999"));
  assert.throws(() => clientPatchFromAnamnese({client_name:{value:"Ana"}}));
  assert.throws(() => clientPatchFromAnamnese({client_email:"bad email"}));
  assert.throws(() => clientPatchFromAnamnese({client_phone:"1".repeat(21)}));
});
test("leap days and SQL dates remain stable", () => {
  assert.equal(clientBirthDate("29/02/2004"), "2004-02-29 12:00:00");
  assert.equal(clientBirthDate("2005-08-02 12:00:00"), "2005-08-02 12:00:00");
});
test("prefill includes documents and full address without leaking internal fields", () => {
  assert.deepEqual(clientPersonalPrefill({name:"Ana",birthDate:"2005-08-02 12:00:00",docNumber:"RG 123",street:"Rua A",number:"75",complement:"Casa",studioId:9,totalSpent:123}),
    {client_name:"Ana",client_dob:"02/08/2005",client_cpf_rg:"RG 123",client_street:"Rua A",client_number:"75",client_complement:"Casa"});
});
