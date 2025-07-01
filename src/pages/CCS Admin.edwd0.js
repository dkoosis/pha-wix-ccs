// src/pages/edwd0.js
import { replaceSchema, verifyCurrentSchema } from 'backend/schema-management.web.js';

console.log('Admin page code loaded');

$w.onReady(function () {
    console.log('Page ready, checking for button...');
    
    if ($w('#updateSchemaButton')) {
        console.log('Button found!');
        
        $w('#updateSchemaButton').onClick(async () => {
            console.log('Button clicked!');
            $w('#statusText').text = 'Updating schema...';
            $w('#updateSchemaButton').disable();
            
            try {
                const result = await replaceSchema();
                console.log('Schema update result:', result);
                
                if (result.success) {
                    $w('#statusText').text = `✅ Schema updated successfully!\nOld revision: ${result.oldRevision}\nNew revision: ${result.newRevision}\nTotal fields: ${result.fieldsCount}`;
                } else {
                    $w('#statusText').text = `❌ Schema update failed: ${result.error}`;
                }
            } catch (error) {
                console.error('Schema update error:', error);
                $w('#statusText').text = `❌ Error: ${error.message}`;
            } finally {
                $w('#updateSchemaButton').enable();
            }
        });
    } else {
        console.log('Button NOT found - check the ID');
    }
});