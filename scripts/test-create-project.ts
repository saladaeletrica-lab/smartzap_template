import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!url || !key) {
    console.error('URL or Key missing');
    process.exit(1);
}

const supabase = createClient(url, key);

async function test() {
    console.log('Inserting test project...');
    const { data, error } = await supabase
        .from('template_projects')
        .insert({
            title: 'Test Create',
            prompt: 'Test Prompt',
            status: 'draft',
            template_count: 1,
            approved_count: 0
        })
        .select()
        .single();
    
    if (error) {
        console.error('Project Insert Error:', JSON.stringify(error, null, 2));
        return;
    }
    
    console.log('Project Inserted:', data);
    
    console.log('Inserting test item...');
    const { data: itemData, error: itemError } = await supabase
        .from('template_project_items')
        .insert({
            project_id: data.id,
            name: 'Test Template',
            content: 'Test Content',
            category: 'MARKETING',
            language: 'pt_BR'
        })
        .select()
        .single();
        
    if (itemError) {
        console.error('Item Insert Error:', JSON.stringify(itemError, null, 2));
        return;
    }
    
    console.log('Item Inserted:', itemData);
    
    // Clean up
    await supabase.from('template_projects').delete().eq('id', data.id);
    console.log('Cleaned up test data');
}

test();
