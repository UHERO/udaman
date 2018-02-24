class AddNewUniverseHawaiiCounty < ActiveRecord::Migration
  def self.up
    change_column :api_applications, :universe, %q(ENUM('UHERO','DBEDT','NTA','COH')), null: false, default: 'UHERO'
    change_column :categories, :universe, %q(ENUM('UHERO','DBEDT','NTA','COH')), null: false, default: 'UHERO'
    change_column :data_lists, :universe, %q(ENUM('UHERO','DBEDT','NTA','COH')), null: false, default: 'UHERO'
    change_column :data_points, :universe, %q(ENUM('UHERO','DBEDT','NTA','COH')), null: false, default: 'UHERO'
    change_column :data_sources, :universe, %q(ENUM('UHERO','DBEDT','NTA','COH')), null: false, default: 'UHERO'
    change_column :feature_toggles, :universe, %q(ENUM('UHERO','DBEDT','NTA','COH')), null: false, default: 'UHERO'
    change_column :geographies, :universe, %q(ENUM('UHERO','DBEDT','NTA','COH')), null: false, default: 'UHERO'
    change_column :measurements, :universe, %q(ENUM('UHERO','DBEDT','NTA','COH')), null: false, default: 'UHERO'
    change_column :public_data_points, :universe, %q(ENUM('UHERO','DBEDT','NTA','COH')), null: false, default: 'UHERO'
    change_column :series, :universe, %q(ENUM('UHERO','DBEDT','NTA','COH')), null: false, default: 'UHERO'
    change_column :source_details, :universe, %q(ENUM('UHERO','DBEDT','NTA','COH')), null: false, default: 'UHERO'
    change_column :sources, :universe, %q(ENUM('UHERO','DBEDT','NTA','COH')), null: false, default: 'UHERO'
    change_column :units, :universe, %q(ENUM('UHERO','DBEDT','NTA','COH')), null: false, default: 'UHERO'
    change_column :users, :universe, %q(ENUM('UHERO','DBEDT','NTA','COH')), null: false, default: 'UHERO'
  end
  def self.down
    change_column :api_applications, :universe, %q(ENUM('UHERO','DBEDT','NTA')), null: false, default: 'UHERO'
    change_column :categories, :universe, %q(ENUM('UHERO','DBEDT','NTA')), null: false, default: 'UHERO'
    change_column :data_lists, :universe, %q(ENUM('UHERO','DBEDT','NTA')), null: false, default: 'UHERO'
    change_column :data_points, :universe, %q(ENUM('UHERO','DBEDT','NTA')), null: false, default: 'UHERO'
    change_column :data_sources, :universe, %q(ENUM('UHERO','DBEDT','NTA')), null: false, default: 'UHERO'
    change_column :feature_toggles, :universe, %q(ENUM('UHERO','DBEDT','NTA')), null: false, default: 'UHERO'
    change_column :geographies, :universe, %q(ENUM('UHERO','DBEDT','NTA')), null: false, default: 'UHERO'
    change_column :measurements, :universe, %q(ENUM('UHERO','DBEDT','NTA')), null: false, default: 'UHERO'
    change_column :public_data_points, :universe, %q(ENUM('UHERO','DBEDT','NTA')), null: false, default: 'UHERO'
    change_column :series, :universe, %q(ENUM('UHERO','DBEDT','NTA')), null: false, default: 'UHERO'
    change_column :source_details, :universe, %q(ENUM('UHERO','DBEDT','NTA')), null: false, default: 'UHERO'
    change_column :sources, :universe, %q(ENUM('UHERO','DBEDT','NTA')), null: false, default: 'UHERO'
    change_column :units, :universe, %q(ENUM('UHERO','DBEDT','NTA')), null: false, default: 'UHERO'
    change_column :users, :universe, %q(ENUM('UHERO','DBEDT','NTA')), null: false, default: 'UHERO'
  end
end
