// src/pages/schema-update.js
import { replaceCollectionSchema, verifySchema } from 'backend/schema-complete-replacement.js';

$w.onReady(function () {
    if ($w('#updateSchemaButton')) {
        $w('#updateSchemaButton').onClick(async () => {
            $w('#statusText').text = 'Updating schema...';
            $w('#updateSchemaButton').disable();
            
            try {
                const result = await replaceCollectionSchema();
                
                if (result.success) {
                    $w('#statusText').text = `✅ Schema updated successfully!\nOld revision: ${result.oldRevision}\nNew revision: ${result.newRevision}\nTotal fields: ${result.fieldsCount}`;
                } else {
                    $w('#statusText').text = `❌ Schema update failed: ${result.error}`;
                }
            } catch (error) {
                $w('#statusText').text = `❌ Error: ${error.message}`;
            } finally {
                $w('#updateSchemaButton').enable();
            }
        });
    }
});