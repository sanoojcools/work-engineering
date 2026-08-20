class NotFoundError(Exception):
    def __init__(self, entity: str, ident) -> None:
        super().__init__(f"{entity} {ident} not found")
        self.entity = entity
        self.ident = ident


class ConflictError(Exception):
    def __init__(self, message: str) -> None:
        super().__init__(message)


class RuleError(Exception):
    """Domain rule violation (G4 promotion, incomplete contract, etc.)."""

    def __init__(self, message: str) -> None:
        super().__init__(message)
