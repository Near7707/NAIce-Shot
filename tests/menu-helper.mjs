// Browser-test helper: actions now live in small menus (⋯, 저장 ▾). Open the menu that holds an
// element, the way a person would, before clicking or reading it. Lists may re-render while
// loading, so the lookup is retried a few times.
export async function reveal(page,target){
  const el=typeof target==='string'?page.locator(target).first():target;
  for(let attempt=0;;attempt++){
    try{
      await el.waitFor({state:'attached',timeout:5000});
      if(await el.isVisible())return el;
      const owner=await el.evaluate(e=>{const pop=e.closest('[popover]');if(pop?.id)return {menu:pop.id};return e.closest('.ncsv-save-menu')?{viewer:true}:null;});
      if(owner?.menu)await page.locator(`[data-image-more="${owner.menu}"]`).click({timeout:2000});
      else if(owner?.viewer)await page.locator('#ncs-viewer [data-v="save-menu"]').click({timeout:2000});
      await el.waitFor({state:'visible',timeout:2000});return el;
    }catch(e){if(attempt>=3)throw e;await page.waitForTimeout(300);}
  }
}
export async function pick(page,target){const el=await reveal(page,target);await el.click();return el;}
