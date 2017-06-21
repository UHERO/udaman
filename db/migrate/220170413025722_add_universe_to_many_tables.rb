class AddUniverseToManyTables < ActiveRecord::Migration
  def change
    add_column :data_lists, :universe, %q(ENUM('UHERO', 'DBEDT', 'NTA')), null: false, default: 'UHERO', after: :id
    add_column :data_points, :universe, %q(ENUM('UHERO', 'DBEDT', 'NTA')), null: false, default: 'UHERO', after: :id
    add_column :data_sources, :universe, %q(ENUM('UHERO', 'DBEDT', 'NTA')), null: false, default: 'UHERO', after: :id
    add_column :feature_toggles, :universe, %q(ENUM('UHERO', 'DBEDT', 'NTA')), null: false, default: 'UHERO', after: :id
    add_column :geographies, :universe, %q(ENUM('UHERO', 'DBEDT', 'NTA')), null: false, default: 'UHERO', after: :id
    add_column :measurements, :universe, %q(ENUM('UHERO', 'DBEDT', 'NTA')), null: false, default: 'UHERO', after: :id
    add_column :public_data_points, :universe, %q(ENUM('UHERO', 'DBEDT', 'NTA')), null: false, default: 'UHERO', first: true
    add_column :source_details, :universe, %q(ENUM('UHERO', 'DBEDT', 'NTA')), null: false, default: 'UHERO', after: :id
    add_column :sources, :universe, %q(ENUM('UHERO', 'DBEDT', 'NTA')), null: false, default: 'UHERO', after: :id
    add_column :users, :universe, %q(ENUM('UHERO', 'DBEDT', 'NTA')), null: false, default: 'UHERO', after: :id
  end
end
