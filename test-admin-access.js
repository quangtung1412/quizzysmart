// Quick test để kiểm tra authentication và admin role
// Chạy trong browser console

console.log('=== Testing Admin Access ===');

// Test 1: Check current user
fetch('/api/auth/me', { credentials: 'include' })
    .then(res => res.json())
    .then(data => {
        console.log('Current user:', data);
        if (data.user) {
            console.log('✅ Logged in as:', data.user.email || data.user.username);
            console.log('Role:', data.user.role);
            if (data.user.role === 'admin') {
                console.log('✅ User is ADMIN');
            } else {
                console.log('❌ User is NOT admin (role:', data.user.role, ')');
            }
        } else {
            console.log('❌ Not logged in');
        }
    })
    .catch(err => console.error('Error checking user:', err));

// Test 2: Try to access admin endpoint
setTimeout(() => {
    console.log('\n=== Testing /api/admin/model-usage ===');
    fetch('/api/admin/model-usage', { credentials: 'include' })
        .then(async res => {
            console.log('Status:', res.status);
            console.log('Content-Type:', res.headers.get('content-type'));

            const contentType = res.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                const data = await res.json();
                console.log('Response:', data);
            } else {
                const text = await res.text();
                console.log('HTML Response (first 300 chars):', text.substring(0, 300));
            }
        })
        .catch(err => console.error('Error:', err));
}, 1000);
