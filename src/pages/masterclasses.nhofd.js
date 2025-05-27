import wixMembers from 'wix-members';
$w.onReady(async function () {
    if (!wixMembers.authentication.loggedIn()) {
        $w('#publicServices').expand()
        return
    } else {
        const roles = await wixMembers.currentMember.getRoles()
        const roleName = roles.map((role) => {
            if (role._id == "2ade445c-7265-420a-8102-484abdd3dc54") return "publicServices"
            else if (role._id == "4ecb331a-1566-4879-9112-65103b74dd70") return "inviteeServices"
            else if (role._id == "ad647c5b-efc7-4c21-b196-376d6ccd85b8") return "allServices"
        })
        if (roleName.includes("publicServices")) {
            $w('#publicServices').expand()
            $w('#allServices').collapse()
            $w('#inviteeServices').collapse()
        }
        if (roleName.includes("inviteeServices")) {
            $w('#publicServices').collapse()
            $w('#allServices').collapse()
            $w('#inviteeServices').expand()
        }
        if (roleName.includes("allServices")) {
            $w('#publicServices').collapse()
            $w('#allServices').expand()
            $w('#inviteeServices').collapse()
        }
    }
});