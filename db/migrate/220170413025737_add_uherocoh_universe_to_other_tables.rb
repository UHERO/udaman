class AddUherocohUniverseToOtherTables < ActiveRecord::Migration
  def self.up
    change_column :feature_toggles, :universe, %q(ENUM('UHERO','DBEDT','NTA','COH','UHEROCOH')), null: false, default: 'UHERO'
  end
  def self.down
    change_column :feature_toggles, :universe, %q(ENUM('UHERO','DBEDT','NTA','COH')), null: false, default: 'UHERO'
  end
end
