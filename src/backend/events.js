import wixMembersBackend from 'wix-members-backend';
export async function wixMembers_onMemberCreated(event) {
    const memberId = event.entity._id;
    await wixMembersBackend.authorization.assignRole("2ade445c-7265-420a-8102-484abdd3dc54", memberId, {
        suppressAuth: true
    })
    console.log(`Member with member ID: ${memberId} created.`);
}