/** True when the selected volunteer is the signed-in help seeker. */
export function isOwnVolunteer(volunteerId: string | null | undefined, userId: string | null | undefined) {
  return Boolean(userId && volunteerId === userId);
}

export function getVolunteerRequestAction(volunteerId: string, userId: string | null | undefined) {
  const disabled = isOwnVolunteer(volunteerId, userId);
  return {
    disabled,
    message: disabled ? "You cannot select yourself as a volunteer." : null,
  };
}

/** Preserve every filtered directory card while attaching its request-action state. */
export function volunteerDirectoryCards<T extends { user_id: string }>(volunteers: T[], userId: string | null | undefined) {
  return volunteers.map((volunteer) => ({
    volunteer,
    requestAction: getVolunteerRequestAction(volunteer.user_id, userId),
  }));
}

/** Keep the directory intact; only Auto-Match uses this to omit the current user. */
export function withoutOwnVolunteer<T extends { user_id: string }>(volunteers: T[], userId: string | null | undefined) {
  return userId ? volunteers.filter((volunteer) => volunteer.user_id !== userId) : volunteers;
}

export function isSelfVolunteerConstraintError(error: { code?: string; message?: string } | null | undefined) {
  return error?.code === "23514" && error.message?.includes("support_request_no_self_volunteer") === true;
}
