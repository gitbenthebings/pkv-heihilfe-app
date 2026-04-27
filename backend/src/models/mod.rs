pub mod anhang;
pub mod beihilfestelle;
pub mod benutzer;
pub mod person;
pub mod correspondent;
pub mod rechnung;

pub use beihilfestelle::{Beihilfestelle, CreateBeihilfestelle, UpdateBeihilfestelle};
pub use benutzer::{Benutzer, CreateBenutzer, UpdateBenutzer, ChangePasswort};
pub use person::{Person, CreatePerson, UpdatePerson};
pub use correspondent::{Correspondent, CreateCorrespondent, UpdateCorrespondent};
pub use rechnung::{Rechnung, RechnungMitStatus, CreateRechnung, UpdateRechnung, BulkAction, BulkActionRequest};
