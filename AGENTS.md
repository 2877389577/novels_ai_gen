# Project Explanation
This is a project for writing Chinese web novels. Use this project to write the specific content of web novels and enhance user inspiration.

## Constraints
1. Any function you create must have its purpose documented in Simplified Chinese, regardless of frontend or backend.
2. Any function parameters, struct or class fields, etc., must have their meanings documented in Simplified Chinese, regardless of frontend or backend.
3. Reuse as much as possible; for example, in an MVC architecture, do not create a struct in the service layer to receive parameters and then create a new struct in the controller layer to receive the service's parameters.
4. For structs that map to/from SQL, field comments compatible with gorm tags must be added; code-level comments alone are not sufficient.

## Frontend-Backend Integration
1. Backend API routes are defined in `internal/api/router/router.go`, and the service layer is located in the `internal/api/handler` directory.